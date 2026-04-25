/**
 * SwipeView — top-level Swipe tab.
 *
 * Translated from the SwiftUI SwipeView in the source doc:
 *   - Renders the top 3 candidates from `run.deck` starting at `deckCursor`
 *   - Drag-to-commit (handled in SwipeCard)
 *   - Tap buttons also commit (delegates to SwipeCard.commit())
 *   - Right swipe queues a MatchCelebration overlay
 *   - Empty state shows "deck is dry" with a Reshuffle button
 *     that just bumps day forward (Pass 1: deck doesn't refill).
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { SwipeCard, SwipeCardHandle } from "./SwipeCard";

import { MatchCelebration } from "@/components/MatchCelebration";
import { NeonButton, PixelPanel, PixelText, ScanlineOverlay } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameContext";
import { Candidate } from "@/core/models";

interface CelebrationState {
  visible: boolean;
  name: string;
}

export function SwipeView() {
  const { run, swipe, advanceDay, hydrated } = useGameState();
  const topCardRef = useRef<SwipeCardHandle>(null);
  const [celebration, setCelebration] = useState<CelebrationState>({
    visible: false,
    name: "",
  });

  const remaining: Candidate[] = useMemo(() => {
    if (!run) return [];
    return run.deck.slice(run.deckCursor);
  }, [run]);

  const handleCommit = useCallback(
    async (direction: "left" | "right") => {
      if (!run) return;
      const top = remaining[0];
      if (!top) return;
      const match = await swipe(top.id, direction);
      if (match && direction === "right") {
        setCelebration({ visible: true, name: top.displayName });
      }
    },
    [remaining, run, swipe],
  );

  const handleButton = useCallback((direction: "left" | "right") => {
    topCardRef.current?.commit(direction);
  }, []);

  const dismissCelebration = useCallback(() => {
    setCelebration({ visible: false, name: "" });
  }, []);

  if (!hydrated) {
    return (
      <View style={styles.center}>
        <PixelText size={10} color={cfPalette.ash}>
          loading case file…
        </PixelText>
      </View>
    );
  }

  if (!run) {
    return (
      <View style={styles.center}>
        <PixelText size={10} color={cfPalette.ash} align="center">
          no active case.{"\n"}return to title.
        </PixelText>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScanlineOverlay />
      <View style={styles.header}>
        <PixelText size={10} color={cfPalette.pinkHot} uppercase glow>
          {`day ${run.day}`}
        </PixelText>
        <PixelText size={8} color={cfPalette.ash}>
          {`${remaining.length} left in deck`}
        </PixelText>
      </View>

      <View style={styles.deckArea}>
        {remaining.length === 0 ? (
          <PixelPanel variant="raised" style={styles.empty}>
            <PixelText size={12} color={cfPalette.cyan} uppercase glow align="center">
              deck is dry
            </PixelText>
            <PixelText
              size={8}
              color={cfPalette.ash}
              align="center"
              style={{ marginTop: 14, lineHeight: 14 }}
            >
              You've worked through everyone in town.{"\n"}Sleep on it.
            </PixelText>
            <NeonButton
              label="Sleep — End Day"
              variant="secondary"
              onPress={advanceDay}
              style={{ marginTop: 24 }}
            />
          </PixelPanel>
        ) : (
          remaining
            .slice(0, 3)
            .map((c, i) => {
              const isTop = i === 0;
              return (
                <SwipeCard
                  key={c.id}
                  ref={isTop ? topCardRef : null}
                  candidate={c}
                  isTop={isTop}
                  stackIndex={i}
                  onCommit={handleCommit}
                />
              );
            })
            .reverse()
        )}
      </View>

      {remaining.length > 0 && (
        <View style={styles.actions}>
          <NeonButton
            label="✕ Pass"
            variant="secondary"
            onPress={() => handleButton("left")}
          />
          <NeonButton
            label="♥ Match"
            variant="primary"
            onPress={() => handleButton("right")}
          />
        </View>
      )}

      <MatchCelebration
        visible={celebration.visible}
        candidateName={celebration.name}
        onDismiss={dismissCelebration}
      />
    </View>
  );
}

const TAB_BAR_PAD = Platform.OS === "web" ? 100 : 0;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: cfPalette.navyDeep,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: TAB_BAR_PAD,
  },
  center: {
    flex: 1,
    backgroundColor: cfPalette.navyDeep,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
    marginBottom: 14,
  },
  deckArea: {
    flex: 1,
    position: "relative",
    marginBottom: 18,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
});
