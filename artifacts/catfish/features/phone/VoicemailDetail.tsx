/**
 * VoicemailDetail — full-screen playback view for a single voicemail.
 *
 * Voicemails are text-only (no actual audio in this pass). Tapping
 * "mark as listened" commits any linked fact to the journal and marks
 * the voicemail as listened.
 */
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { PixelPanel, PixelText, ScanlineOverlay } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";
import type { Voicemail } from "@/core/models";

import { PhoneIcon } from "./PhoneIcon";

interface Props {
  voicemail: Voicemail;
  onClose: () => void;
}

const FRIEND_NAMES: Record<string, string> = {
  dev: "Dev",
  nia: "Nia",
  alex: "Alex",
  morgan: "Morgan",
};

export function VoicemailDetail({ voicemail, onClose }: Props) {
  const markVmListened = useGameState((s) => s.markVmListened);
  const run = useGameState((s) => s.run);

  useEffect(() => {
    if (!voicemail.listened) {
      void markVmListened(voicemail.id);
    }
  }, []);

  const linkedFact = run?.facts.find((f) => f.id === voicemail.linkedFactId);
  const friendName = FRIEND_NAMES[voicemail.friend] ?? voicemail.friend;

  return (
    <View style={styles.root}>
      <ScanlineOverlay />
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
          <PixelText size={8} color={cfPalette.ash} uppercase>
            ✕ close
          </PixelText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.senderRow}>
          <View style={styles.avatar}>
            <PixelText size={12} color={cfPalette.bone} uppercase>
              {friendName.slice(0, 2)}
            </PixelText>
          </View>
          <View>
            <PixelText size={10} color={cfPalette.bone} uppercase>
              {friendName}
            </PixelText>
            <PixelText size={6} color={cfPalette.ash} style={{ marginTop: 2 }}>
              voicemail · day {voicemail.day}
            </PixelText>
          </View>
        </View>

        <PixelPanel variant="raised" style={styles.messagePanel}>
          <PixelText size={9} color={cfPalette.bone} style={{ lineHeight: 16 }}>
            {voicemail.text}
          </PixelText>
        </PixelPanel>

        {linkedFact && (
          <View style={styles.linkedFact}>
            <PixelText size={6} color={cfPalette.purpleHot} uppercase style={{ marginBottom: 4 }}>
              linked evidence
            </PixelText>
            <PixelText size={8} color={cfPalette.bone}>
              {linkedFact.payload.text}
            </PixelText>
          </View>
        )}

        {!voicemail.listened && !linkedFact && (
          <PixelText size={6} color={cfPalette.fog} style={{ marginTop: 8, textAlign: "center" }}>
            no linked evidence on this tip
          </PixelText>
        )}
      </ScrollView>
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
  closeBtn: {
    padding: 4,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  senderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: cfPalette.purple,
    alignItems: "center",
    justifyContent: "center",
  },
  messagePanel: {
    padding: 16,
    marginBottom: 16,
  },
  linkedFact: {
    padding: 12,
    borderWidth: 1,
    borderColor: cfPalette.purple,
    borderRadius: 4,
  },
});