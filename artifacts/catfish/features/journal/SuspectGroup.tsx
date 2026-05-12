/**
 * SuspectGroup — header + stack of FactCards belonging to a single
 * matched candidate. Mirrors the SwiftUI grouping in the source doc:
 * one labeled section per suspect with the avatar inline so the
 * player can scan the case file at a glance.
 */

import { StyleSheet, View } from "react-native";

import { AssetImage } from "@/components/AssetImage";
import { PixelText } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { Candidate, Fact } from "@/core/models";

import { FactCard } from "./FactCard";

interface SuspectGroupProps {
  candidate: Candidate;
  facts: Fact[];
  onDiscardFact: (factId: string) => void;
  onPressFact?: (fact: Fact) => void;
}

export function SuspectGroup({
  candidate,
  facts,
  onDiscardFact,
  onPressFact,
}: SuspectGroupProps) {
  if (facts.length === 0) return null;

  return (
    <View style={styles.group}>
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          <AssetImage
            id={candidate.portraitAssetId ?? "A500_avatar_placeholder"}
            style={styles.avatar}
            containerStyle={styles.avatar}
            resizeMode="cover"
          />
        </View>
        <View style={styles.headerText}>
          <PixelText size={11} color={cfPalette.bone} uppercase>
            {candidate.displayName}
          </PixelText>
          <PixelText size={6} color={cfPalette.ash} uppercase style={styles.count}>
            {`${facts.length} fact${facts.length === 1 ? "" : "s"} on file`}
          </PixelText>
        </View>
      </View>

      <View style={styles.cards}>
        {facts.map((f) => (
          <FactCard key={f.id} fact={f} onDiscard={onDiscardFact} onPress={onPressFact} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  avatarWrap: {
    width: 36,
    height: 36,
  },
  avatar: {
    width: 36,
    height: 36,
  },
  headerText: {
    paddingLeft: 10,
    flex: 1,
  },
  count: {
    marginTop: 4,
  },
  cards: {
    gap: 8,
  },
});
