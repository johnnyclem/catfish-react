/**
 * SocialFeedScreen — Instagram-style social feed, rendered as a
 * sub-section of the Journal app.
 *
 * Renders the active candidate's authored social posts as a vertical
 * scroll of square photo cards with caption overlays. Each card shows
 * the character's social lifestyle image and the caption text derived
 * from `run.facts` (authored, with killer-variant overrides applied).
 *
 * The feed surfaces one character at a time — the player selects from
 * the candidates they've matched with, and the feed shows that
 * character's social posts for the current run. This is a sleuthing
 * surface (caption clues, killer-variant tells) so it lives in the
 * Journal, not in the dating-app shell.
 *
 * Layer 2 of the Saint Mask system: variable facts in `run.facts`
 * carry killer-variant caption text via `variableOverrides` at
 * bootstrap time, so the player sees different captions depending on
 * which identity is the active killer.
 */

import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { AssetImage } from "@/components/AssetImage";
import {
  PixelPanel,
  PixelText,
  ScanlineOverlay,
} from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";
import { Candidate, Fact } from "@/core/models";

/** Social image asset ids per character (first IG post per char). */
const SOCIAL_IMAGE: Record<string, string> = {
  kai: "A700_kai_social_cafe_window",
  river: "A720_river_social_mountain_overlook",
  miles: "A740_miles_social_office_skyline",
  sam: "A760_sam_social_group_bar",
  jules: "A780_jules_social_london_bigben",
};

function getSocialImage(characterId: string): string {
  return SOCIAL_IMAGE[characterId] ?? "A500_avatar_placeholder";
}

/** Extract the day label from a fact. */
function factDayLabel(fact: Fact): string {
  return `day ${fact.day}`;
}

interface SocialCardProps {
  fact: Fact;
  imageId: string;
}

function SocialCard({ fact, imageId }: SocialCardProps) {
  const caption = fact.payload.text ?? "";
  return (
    <PixelPanel variant="raised" style={styles.card}>
      <View style={styles.cardImageWrap}>
        <AssetImage
          id={imageId}
          style={styles.cardImage}
          containerStyle={styles.cardImage}
          resizeMode="cover"
        />
      </View>
      <View style={styles.cardBody}>
        <PixelText size={6} color={cfPalette.cyan} uppercase>
          {factDayLabel(fact)}
        </PixelText>
        <PixelText
          size={8}
          color={cfPalette.bone}
          style={styles.caption}
          
        >
          {caption}
        </PixelText>
      </View>
    </PixelPanel>
  );
}

interface CharacterPickerProps {
  candidates: Candidate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function CharacterPicker({ candidates, selectedId, onSelect }: CharacterPickerProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.pickerRow}
    >
      {candidates.map((c) => {
        const active = c.identity === selectedId;
        return (
          <Pressable
            key={c.id}
            onPress={() => c.identity && onSelect(c.identity)}
            style={({ pressed }) => [
              styles.pickerChip,
              active && styles.pickerChipActive,
              pressed && { opacity: 0.6 },
            ]}
          >
            <PixelText
              size={7}
              color={active ? cfPalette.void : cfPalette.cyan}
              uppercase
            >
              {c.displayName}
            </PixelText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function SocialFeedScreen() {
  const run = useGameState((s) => s.run);

  const matchedCandidates = useMemo<Candidate[]>(() => {
    if (!run) return [];
    const matchedIds = new Set(run.matches.map((m) => m.candidateId));
    return run.deck.filter((c) => matchedIds.has(c.id) && c.identity != null);
  }, [run]);

  const [selectedIdentity, setSelectedIdentity] = useState<string | null>(
    matchedCandidates[0]?.identity ?? null,
  );

  const instagramFacts = useMemo<Fact[]>(() => {
    if (!run || !selectedIdentity) return [];
    return run.facts
      .filter(
        (f) =>
          f.source.kind === "instagram" &&
          f.aboutCharacter === selectedIdentity,
      )
      .sort((a, b) => a.day - b.day);
  }, [run, selectedIdentity]);

  if (!run) {
    return (
      <View style={styles.root}>
        <ScanlineOverlay />
        <View style={styles.empty}>
          <PixelText size={9} color={cfPalette.ash} align="center">
            No active case.
          </PixelText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScanlineOverlay />
      <PixelText size={14} color={cfPalette.cyan} uppercase glow style={styles.title}>
        social
      </PixelText>
      <PixelText size={7} color={cfPalette.ash} style={styles.subtitle}>
        Tap a character to filter their posts.
      </PixelText>

      {matchedCandidates.length > 0 && (
        <CharacterPicker
          candidates={matchedCandidates}
          selectedId={selectedIdentity}
          onSelect={setSelectedIdentity}
        />
      )}

      <ScrollView
        contentContainerStyle={styles.feed}
        showsVerticalScrollIndicator={false}
      >
        {instagramFacts.length === 0 ? (
          <View style={styles.empty}>
            <PixelText size={8} color={cfPalette.ash} align="center" style={{ lineHeight: 13 }}>
              No posts yet.
              {"\n"}Check back after a date.
            </PixelText>
          </View>
        ) : (
          instagramFacts.map((fact) => (
            <SocialCard
              key={fact.id}
              fact={fact}
              imageId={getSocialImage(selectedIdentity ?? "kai")}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: cfPalette.navyDeep,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  title: { marginTop: 8 },
  subtitle: { marginTop: 6, marginBottom: 14 },
  pickerRow: {
    gap: 8,
    marginBottom: 14,
    paddingRight: 18,
  },
  pickerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: cfPalette.cyan,
    backgroundColor: "rgba(3,1,10,0.6)",
  },
  pickerChipActive: {
    backgroundColor: cfPalette.cyan,
    borderColor: cfPalette.cyanHot,
  },
  feed: {
    gap: 14,
    paddingBottom: 24,
  },
  card: {
    overflow: "hidden",
  },
  cardImageWrap: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: cfPalette.iron,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardBody: {
    padding: 12,
  },
  caption: {
    marginTop: 8,
    lineHeight: 13,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
});