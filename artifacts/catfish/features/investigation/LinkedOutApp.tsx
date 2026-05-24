/**
 * LinkedOutApp — pixel-noir "professional network" background-check.
 *
 * Two modes:
 *
 *   - **Search** (cold launch): a list of every match in the current
 *     run, sorted by displayName. The player taps one to land on that
 *     candidate's profile.
 *
 *   - **Profile**: a LinkedIn-style detail page for the chosen
 *     candidate. Headline, location, experience timeline, education,
 *     skills, mutuals. Rows are pulled from `core/onlineFootprint.ts`
 *     and filtered through their day/fact gates so the killer's
 *     "flagged" job rows only appear once the player has captured the
 *     unlocking fact.
 *
 * Opening a row tagged with `linkedFactId` commits the fact to the
 * Journal via the existing `commitFact` pattern.
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { AssetImage } from "@/components/AssetImage";
import { PixelText, ScanlineOverlay } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import type { Candidate } from "@/core/models";
import {
  type LinkedOutProfile,
  type LinkedOutRow,
  getLinkedOutFor,
} from "@/core/onlineFootprint";
import { useGameState } from "@/core/gameStore";

function ProfileView({
  candidate,
  profileData,
  onBack,
  onRowTap,
}: {
  candidate: Candidate;
  profileData: {
    profile: LinkedOutProfile;
    visibleExperience: LinkedOutRow[];
    visibleEducation: LinkedOutRow[];
  };
  onBack: () => void;
  onRowTap: (row: LinkedOutRow) => void;
}) {
  const { profile, visibleExperience, visibleEducation } = profileData;
  const empty = visibleExperience.length === 0 && visibleEducation.length === 0;

  return (
    <View style={styles.root}>
      <ScanlineOverlay />
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn} testID="linkedout-back">
          <PixelText size={8} color={cfPalette.cyan}>← back</PixelText>
        </Pressable>
        <PixelText size={9} color={cfPalette.bone} style={{ flex: 1, textAlign: "center" }}>
          linkedout
        </PixelText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <AssetImage
              id={candidate.portraitAssetId ?? "A500_avatar_placeholder"}
              style={styles.avatarImg}
              containerStyle={styles.avatarImg}
              resizeMode="cover"
            />
          </View>
          <PixelText size={12} color={cfPalette.bone} style={{ marginTop: 10 }}>
            {candidate.displayName}
          </PixelText>
          <PixelText size={7} color={cfPalette.fog} style={{ marginTop: 4 }}>
            {profile.headline}
          </PixelText>
          <PixelText size={6} color={cfPalette.ash} style={{ marginTop: 4 }}>
            {profile.location} · {profile.mutuals} mutual{profile.mutuals === 1 ? "" : "s"}
          </PixelText>
        </View>

        {empty ? (
          <View style={styles.emptyState}>
            <PixelText size={8} color={cfPalette.ash} align="center">
              profile is mostly empty
            </PixelText>
            <PixelText
              size={6}
              color={cfPalette.fog}
              align="center"
              style={{ marginTop: 8, paddingHorizontal: 28, lineHeight: 11 }}
            >
              nothing here yet. capture a clue elsewhere and check back.
            </PixelText>
          </View>
        ) : (
          <>
            {visibleExperience.length > 0 && (
              <View style={styles.section}>
                <PixelText size={6} color={cfPalette.ash} style={styles.sectionLabel}>
                  experience
                </PixelText>
                {visibleExperience.map((row) => (
                  <Pressable
                    key={row.id}
                    onPress={() => onRowTap(row)}
                    style={({ pressed }) => [
                      styles.row,
                      pressed && { opacity: 0.6 },
                      row.flagged && { borderLeftColor: cfPalette.pinkHot, borderLeftWidth: 3, paddingLeft: 9 },
                    ]}
                  >
                    <PixelText size={8} color={cfPalette.bone}>
                      {row.title}
                    </PixelText>
                    <PixelText size={6} color={cfPalette.fog} style={{ marginTop: 2 }}>
                      {row.org}
                    </PixelText>
                    <PixelText size={5} color={cfPalette.ash} style={{ marginTop: 2 }}>
                      {row.years}
                    </PixelText>
                  </Pressable>
                ))}
              </View>
            )}

            {visibleEducation.length > 0 && (
              <View style={styles.section}>
                <PixelText size={6} color={cfPalette.ash} style={styles.sectionLabel}>
                  education
                </PixelText>
                {visibleEducation.map((row) => (
                  <View key={row.id} style={styles.row}>
                    <PixelText size={8} color={cfPalette.bone}>{row.title}</PixelText>
                    <PixelText size={6} color={cfPalette.fog} style={{ marginTop: 2 }}>{row.org}</PixelText>
                    <PixelText size={5} color={cfPalette.ash} style={{ marginTop: 2 }}>{row.years}</PixelText>
                  </View>
                ))}
              </View>
            )}

            {profile.skills.length > 0 && (
              <View style={styles.section}>
                <PixelText size={6} color={cfPalette.ash} style={styles.sectionLabel}>
                  skills
                </PixelText>
                <View style={styles.skillRow}>
                  {profile.skills.map((s) => (
                    <View key={s} style={styles.skillPill}>
                      <PixelText size={6} color={cfPalette.fog}>{s}</PixelText>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

export function LinkedOutApp() {
  const run = useGameState((s) => s.run);
  const commitFact = useGameState((s) => s.commitFact);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  // The list of candidates the player can background-check is whoever
  // is on the run's deck. Killer + decoys all eligible — that's the
  // pool the player has interacted with on Lots 'o Fish.
  const candidates = run?.deck ?? [];
  const sorted = [...candidates].sort((a, b) => a.displayName.localeCompare(b.displayName));

  const knownFactIds = new Set<string>((run?.facts ?? []).map((f) => f.authoringKey));

  function handleRowTap(row: LinkedOutRow, candidate: Candidate) {
    if (!row.linkedFactId) return;
    if (knownFactIds.has(row.linkedFactId)) return;
    void commitFact({
      candidateId: candidate.id,
      quote: `[LinkedOut] ${candidate.displayName} — ${row.title} @ ${row.org} (${row.years})`,
    });
  }

  if (selectedCandidateId) {
    const candidate = candidates.find((c) => c.id === selectedCandidateId);
    if (!candidate) {
      setSelectedCandidateId(null);
      return null;
    }
    const profileData = getLinkedOutFor(candidate.displayName, run);
    if (!profileData) {
      return (
        <View style={styles.root}>
          <ScanlineOverlay />
          <View style={styles.header}>
            <Pressable onPress={() => setSelectedCandidateId(null)} style={styles.backBtn}>
              <PixelText size={8} color={cfPalette.cyan}>← back</PixelText>
            </Pressable>
            <PixelText size={9} color={cfPalette.bone} style={{ flex: 1, textAlign: "center" }}>
              linkedout
            </PixelText>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.emptyState}>
            <PixelText size={8} color={cfPalette.ash} align="center">
              no profile found
            </PixelText>
          </View>
        </View>
      );
    }
    return (
      <ProfileView
        candidate={candidate}
        profileData={profileData}
        onBack={() => setSelectedCandidateId(null)}
        onRowTap={(row) => handleRowTap(row, candidate)}
      />
    );
  }

  return (
    <View style={styles.root}>
      <ScanlineOverlay />
      <View style={styles.header}>
        <PixelText size={11} color={cfPalette.bone}>
          linkedout
        </PixelText>
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
        <PixelText size={6} color={cfPalette.ash}>
          tap a name to view their profile
        </PixelText>
      </View>
      <ScrollView style={{ flex: 1 }}>
        {sorted.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => setSelectedCandidateId(c.id)}
            testID={`linkedout-candidate-${c.id}`}
            style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]}
          >
            <View style={styles.listAvatar}>
              <AssetImage
                id={c.portraitAssetId ?? "A500_avatar_placeholder"}
                style={styles.listAvatarImg}
                containerStyle={styles.listAvatarImg}
                resizeMode="cover"
              />
            </View>
            <View style={{ flex: 1, paddingLeft: 10 }}>
              <PixelText size={9} color={cfPalette.bone}>
                {c.displayName}
              </PixelText>
              <PixelText size={6} color={cfPalette.fog} style={{ marginTop: 3 }}>
                {c.tagline}
              </PixelText>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: cfPalette.navyDeep },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: cfPalette.iron,
  },
  backBtn: { width: 40 },
  profileCard: {
    alignItems: "center",
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: cfPalette.iron,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: cfPalette.cyan,
  },
  avatarImg: { width: 72, height: 72 },
  section: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  sectionLabel: {
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: cfPalette.void,
    marginBottom: 6,
  },
  skillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  skillPill: {
    backgroundColor: cfPalette.iron,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  listAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: cfPalette.iron,
  },
  listAvatarImg: { width: 40, height: 40 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
});
