/**
 * PhoneApp — call log, voicemail inbox, and friend contacts.
 *
 * Phase 9 — three surfaces in one app:
 *   Recents  — recent missed calls + voicemail badges
 *   Voicemail — all received voicemails with text playback
 *   Contacts — tap Dev or Nia to initiate an outgoing call (costs 1 credit)
 *
 * The app is a full screen driven by internal tab state.
 * It lives as its own home-grid app and is accessed by tapping the
 * Phone tile on the parody home screen.
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { PixelText, ScanlineOverlay } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";
import type { FriendID, Voicemail } from "@/core/models";

import { PhoneIcon } from "./PhoneIcon";
import { FriendCallDialogue } from "./FriendCallDialogue";
import { VoicemailDetail } from "./VoicemailDetail";

type Tab = "recents" | "voicemail" | "contacts";

const PHONE_CONTACTS: Array<{ friend: FriendID; name: string; portraitId: string }> = [
  { friend: "dev", name: "Dev", portraitId: "A079_dev_portrait_neutral" },
  { friend: "nia", name: "Nia", portraitId: "A082_morgan_portrait_neutral" },
];

function CallLogEntry({
  voicemail,
  onTap,
}: {
  voicemail: Voicemail;
  onTap: () => void;
}) {
  const friend = PHONE_CONTACTS.find((c) => c.friend === voicemail.friend);
  const friendName = friend?.name ?? voicemail.friend;
  return (
    <Pressable onPress={onTap} style={({ pressed }) => [styles.callRow, pressed && { opacity: 0.7 }]}>
      <View style={styles.callAvatar}>
        <PixelText size={9} color={cfPalette.ash} uppercase>
          {friendName.slice(0, 2)}
        </PixelText>
      </View>
      <View style={styles.callInfo}>
        <PixelText size={9} color={cfPalette.bone} uppercase>
          {friendName}
        </PixelText>
        <PixelText size={6} color={cfPalette.cyan} style={{ marginTop: 2 }}>
          {voicemail.listened ? "voicemail saved" : "new voicemail"}
        </PixelText>
      </View>
      <PixelText size={6} color={cfPalette.ash} style={{ alignSelf: "center" }}>
        day {voicemail.day}
      </PixelText>
    </Pressable>
  );
}

function VoicemailListItem({
  voicemail,
  onTap,
}: {
  voicemail: Voicemail;
  onTap: () => void;
}) {
  const friend = PHONE_CONTACTS.find((c) => c.friend === voicemail.friend);
  const friendName = friend?.name ?? voicemail.friend;
  return (
    <Pressable onPress={onTap} style={({ pressed }) => [styles.vmRow, pressed && { opacity: 0.7 }]}>
      <View style={[styles.vmAvatar, !voicemail.listened && styles.vmAvatarNew]}>
        <PixelText size={8} color={cfPalette.bone} uppercase>
          {friendName.slice(0, 2)}
        </PixelText>
      </View>
      <View style={{ flex: 1 }}>
        <PixelText size={8} color={cfPalette.bone} uppercase>
          {friendName}
          {!voicemail.listened && (
            <PixelText size={8} color={cfPalette.pinkHot}> · new</PixelText>
          )}
        </PixelText>
        <PixelText size={6} color={cfPalette.ash} numberOfLines={2} style={{ marginTop: 2, lineHeight: 10 }}>
          {voicemail.text}
        </PixelText>
      </View>
      <PixelText size={5} color={cfPalette.fog} style={{ alignSelf: "flex-start", marginTop: 2 }}>
        day {voicemail.day}
      </PixelText>
    </Pressable>
  );
}

function ContactCard({
  friend,
  name,
  portraitId,
  creditsLeft,
  onCall,
}: {
  friend: FriendID;
  name: string;
  portraitId: string;
  creditsLeft: number;
  onCall: () => void;
}) {
  const canCall = creditsLeft > 0;
  return (
    <View style={styles.contactCard}>
      <View style={styles.contactPortrait}>
        <PixelText size={14} color={cfPalette.ash} uppercase>
          {name.slice(0, 1)}
        </PixelText>
      </View>
      <View style={styles.contactInfo}>
        <PixelText size={10} color={cfPalette.bone} uppercase>
          {name}
        </PixelText>
        <PixelText size={6} color={cfPalette.ash} style={{ marginTop: 2 }}>
          {creditsLeft} call{creditsLeft !== 1 ? "s" : ""} left today
        </PixelText>
      </View>
      <Pressable
        onPress={onCall}
        disabled={!canCall}
        style={({ pressed }) => [
          styles.callBtn,
          !canCall && { opacity: 0.4 },
          pressed && canCall && { opacity: 0.7 },
        ]}
      >
        <PixelText size={7} color={canCall ? cfPalette.void : cfPalette.ash} uppercase>
          call
        </PixelText>
      </Pressable>
    </View>
  );
}

function TabBar({
  activeTab,
  onTab,
}: {
  activeTab: Tab;
  onTab: (tab: Tab) => void;
}) {
  const tabs: Tab[] = ["recents", "voicemail", "contacts"];
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => (
        <Pressable
          key={tab}
          onPress={() => onTab(tab)}
          style={[styles.tab, activeTab === tab && styles.tabActive]}
        >
          <PixelText
            size={7}
            color={activeTab === tab ? cfPalette.bone : cfPalette.ash}
            uppercase
          >
            {tab}
          </PixelText>
        </Pressable>
      ))}
    </View>
  );
}

export function PhoneApp() {
  const run = useGameState((s) => s.run);
  const [activeTab, setActiveTab] = useState<Tab>("recents");
  const [selectedVm, setSelectedVm] = useState<Voicemail | null>(null);
  const [callingFriend, setCallingFriend] = useState<FriendID | null>(null);

  const voicemails = run?.voicemails ?? [];
  const credits = run?.phoneCredits ?? { lastRefillDay: run?.day ?? 1, devCalls: 3, niaCalls: 3 };
  const unlistenedCount = voicemails.filter((v) => !v.listened).length;

  const unreadBadge = unlistenedCount;

  const recentsVoicemails = [...voicemails].reverse().slice(0, 10);

  function handleCall(friend: FriendID) {
    const creditsLeft = friend === "dev" ? credits.devCalls : credits.niaCalls;
    if (creditsLeft <= 0) return;
    setCallingFriend(friend);
  }

  if (callingFriend) {
    return (
      <FriendCallDialogue
        friend={callingFriend}
        runId={run?.id ?? "unknown"}
        onClose={() => setCallingFriend(null)}
      />
    );
  }

  if (selectedVm) {
    return (
      <VoicemailDetail
        voicemail={selectedVm}
        onClose={() => setSelectedVm(null)}
      />
    );
  }

  return (
    <View style={styles.root}>
      <ScanlineOverlay />
      <View style={styles.header}>
        <PhoneIcon size={24} />
        <PixelText size={11} color={cfPalette.bone} uppercase style={{ marginLeft: 10 }}>
          phone
        </PixelText>
        {unreadBadge > 0 && (
          <View style={styles.unreadBadge}>
            <PixelText size={5} color={cfPalette.bone}>
              {unreadBadge} new
            </PixelText>
          </View>
        )}
      </View>

      <TabBar activeTab={activeTab} onTab={setActiveTab} />

      {activeTab === "recents" && (
        <ScrollView contentContainerStyle={styles.list}>
          {recentsVoicemails.length === 0 ? (
            <View style={styles.empty}>
              <PixelText size={8} color={cfPalette.ash} align="center">
                no recent calls
              </PixelText>
            </View>
          ) : (
            recentsVoicemails.map((vm) => (
              <CallLogEntry
                key={vm.id}
                voicemail={vm}
                onTap={() => setSelectedVm(vm)}
              />
            ))
          )}
        </ScrollView>
      )}

      {activeTab === "voicemail" && (
        <ScrollView contentContainerStyle={styles.list}>
          {voicemails.length === 0 ? (
            <View style={styles.empty}>
              <PixelText size={8} color={cfPalette.ash} align="center">
                no voicemails yet
              </PixelText>
            </View>
          ) : (
            voicemails.map((vm) => (
              <VoicemailListItem
                key={vm.id}
                voicemail={vm}
                onTap={() => setSelectedVm(vm)}
              />
            ))
          )}
        </ScrollView>
      )}

      {activeTab === "contacts" && (
        <ScrollView contentContainerStyle={styles.list}>
          <PixelText size={6} color={cfPalette.fog} style={{ marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
            friends · 3 calls per day each
          </PixelText>
          {PHONE_CONTACTS.map((c) => {
            const creditsLeft = c.friend === "dev" ? credits.devCalls : credits.niaCalls;
            return (
              <ContactCard
                key={c.friend}
                friend={c.friend}
                name={c.name}
                portraitId={c.portraitId}
                creditsLeft={creditsLeft}
                onCall={() => handleCall(c.friend)}
              />
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: cfPalette.navyDeep,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: cfPalette.iron,
  },
  unreadBadge: {
    marginLeft: 10,
    backgroundColor: cfPalette.pinkHot,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: cfPalette.iron,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: cfPalette.pinkHot,
  },
  list: {
    padding: 12,
    paddingBottom: 32,
  },
  empty: {
    paddingVertical: 32,
    alignItems: "center",
  },
  callRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: cfPalette.iron,
    gap: 12,
  },
  callAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: cfPalette.iron,
    alignItems: "center",
    justifyContent: "center",
  },
  callInfo: {
    flex: 1,
  },
  vmRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: cfPalette.iron,
    gap: 10,
  },
  vmAvatar: {
    width: 36,
    height: 36,
    borderRadius: 4,
    backgroundColor: cfPalette.iron,
    alignItems: "center",
    justifyContent: "center",
  },
  vmAvatarNew: {
    backgroundColor: cfPalette.purple,
    borderWidth: 1,
    borderColor: cfPalette.pinkHot,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: cfPalette.iron,
    gap: 14,
  },
  contactPortrait: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: cfPalette.iron,
    alignItems: "center",
    justifyContent: "center",
  },
  contactInfo: {
    flex: 1,
  },
  callBtn: {
    backgroundColor: cfPalette.cyan,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
  },
});