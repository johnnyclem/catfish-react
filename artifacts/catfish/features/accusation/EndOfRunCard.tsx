/**
 * EndOfRunCard — full-screen overlay for a closed run.
 *
 * Reads the resolved `AccusationResult` off `run.ending` and renders
 * the right copy for each of the four `CaseEnding`s. Mounted at the
 * root layout so it covers every tab + the chat / thread stacks the
 * moment the resolver fires (player accusation OR Day 7 face-to-face
 * via `advanceDay`).
 *
 * Two ways out:
 *   - "Start New Case"  → calls `startNewRun()`, which clears the
 *                         deck + facts + ending and routes back to
 *                         the swipe deck for a fresh case.
 *   - "Back To Title"   → calls `dismissAccusation()` so the overlay
 *                         goes away, then routes to "/" so the player
 *                         can review the title menu before deciding
 *                         to start a new run.
 *
 * The card always shows the matched deduction's `narrativeBeat` when
 * one is set (the resolver writes it directly into
 * `result.narrativeBeat`); otherwise the resolver's stock fallback
 * line lands there and we surface that. The required-fact bullet list
 * appears only when a `matchedDeduction` is present — i.e. when the
 * player actually had the full chain of evidence on the board.
 */

import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, Platform, ScrollView, StyleSheet, View } from "react-native";

import {
  NeonButton,
  PixelPanel,
  PixelText,
  ScanlineOverlay,
} from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";
import { getIdentityModule } from "@/core/identities";
import { AccusationResult, CaseEnding, KillerIdentity } from "@/core/models";
import { emitSfx } from "@/features/audio/audioEvents";
import { usePhoneShell } from "@/features/parody/phoneShellState";

interface EndingPalette {
  /** Loud header (e.g. "Caught Them"). */
  title: string;
  /** Short subhead the player reads before the body copy. */
  subhead: string;
  /** Color for the header text + accent border. */
  accent: string;
}

function paletteForEnding(
  ending: CaseEnding,
  killerName: string,
): EndingPalette {
  switch (ending) {
    case "caughtThem":
      return {
        title: "case closed",
        subhead: `You named ${killerName} — and you were right.`,
        accent: cfPalette.ok,
      };
    case "wrongfulAccusation":
      return {
        title: "wrong call",
        subhead:
          "You filed against the wrong suspect. The real killer's still out there.",
        accent: cfPalette.err,
      };
    case "metKillerStub":
      return {
        title: "face to face",
        subhead: `You met ${killerName} in person before you'd named them.`,
        accent: cfPalette.warn,
      };
    case "escapedStub":
      return {
        title: "they got away",
        subhead: "You walked away. By the time you were sure, they'd already left town.",
        accent: cfPalette.fog,
      };
  }
}

export function EndOfRunCard() {
  const run = useGameState((s) => s.run);
  const startNewRun = useGameState((s) => s.startNewRun);
  const dismissAccusation = useGameState((s) => s.dismissAccusation);
  const [busy, setBusy] = useState(false);

  // Win/lose sting fires the first frame the result is on screen.
  // The effect dep is the ending string itself — it can only flip
  // null→<value> for a given run, so we won't re-fire on re-renders.
  // `caughtThem` is the only happy ending; everything else is a loss.
  const endingTag: CaseEnding | null = run?.ending?.ending ?? null;
  useEffect(() => {
    if (!endingTag) return;
    emitSfx(endingTag === "caughtThem" ? "win" : "lose");
  }, [endingTag]);

  // Hidden until the resolver has fired and stamped a result onto the
  // run. Both player accusations and the Day 7 face-to-face beat take
  // this same path.
  if (!run || !run.ending) return null;

  const result: AccusationResult = run.ending;
  const truthIdentity: KillerIdentity = run.killer;
  const truthName = getIdentityModule(truthIdentity).displayName;
  const palette = paletteForEnding(result.ending, truthName);

  const handleNewCase = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Wipes the deck, facts, threads, swipes, ending — fresh run.
      // We also reset the parody phone shell back to the home grid
      // so the player lands on the new case from the same surface
      // they'd see by tapping "Continue" off the title screen, not
      // mid-Lots-'o-Fish from whatever tab they were on when the
      // previous case closed.
      await startNewRun();
      usePhoneShell.getState().goHome();
      usePhoneShell.getState().setLotsOfFishView("splash");
      router.replace("/home" as never);
    } finally {
      setBusy(false);
    }
  };

  const handleBackToTitle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Just clears the overlay; the run stays `closed`. Player lands
      // on the title screen, which already routes by `run` presence.
      await dismissAccusation();
      router.replace("/");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      // Hardware back on Android falls through to the same dismiss
      // path so the player isn't trapped in the overlay.
      onRequestClose={() => {
        void handleBackToTitle();
      }}
    >
      <View style={styles.overlay} testID="end-of-run-card">
        <ScanlineOverlay />
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <PixelPanel
            variant="raised"
            borderColor={palette.accent}
            style={styles.card}
          >
            <PixelText
              size={9}
              color={cfPalette.ash}
              uppercase
              align="center"
              style={styles.kicker}
            >
              run · day {run.day}
            </PixelText>
            <PixelText
              size={18}
              color={palette.accent}
              uppercase
              glow
              align="center"
              style={styles.title}
            >
              {palette.title}
            </PixelText>
            <PixelText
              size={8}
              color={cfPalette.bone}
              align="center"
              style={styles.subhead}
            >
              {palette.subhead}
            </PixelText>

            <View style={styles.divider} />

            <PixelText
              size={7}
              color={cfPalette.cyan}
              uppercase
              style={styles.beatLabel}
            >
              what happened
            </PixelText>
            <PixelText
              size={9}
              color={cfPalette.bone}
              style={styles.beat}
            >
              {result.narrativeBeat}
            </PixelText>

            {result.matchedDeduction ? (
              <View style={styles.deductionBlock}>
                <PixelText
                  size={7}
                  color={cfPalette.purpleHot}
                  uppercase
                  style={styles.beatLabel}
                >
                  the chain you laid
                </PixelText>
                {result.matchedDeduction.requiredFactIDs.map((id) => (
                  <View key={id} style={styles.bulletRow}>
                    <PixelText size={9} color={cfPalette.pinkHot} glow>
                      ▸
                    </PixelText>
                    <PixelText
                      size={8}
                      color={cfPalette.ash}
                      style={styles.bulletText}
                    >
                      {id.replace(/_/g, " ")}
                    </PixelText>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Always reveal the truth at the end — the player
                deserves to know who it was, even on a wrongful or
                escaped run. */}
            <View style={styles.truthBlock}>
              <PixelText
                size={7}
                color={cfPalette.warn}
                uppercase
                style={styles.beatLabel}
              >
                the truth
              </PixelText>
              <PixelText
                size={9}
                color={cfPalette.bone}
                style={styles.beat}
              >
                {`The killer was ${truthName}.`}
              </PixelText>
            </View>

            <View style={styles.actions}>
              <NeonButton
                label="Start New Case"
                variant="primary"
                size="lg"
                fullWidth
                onPress={handleNewCase}
                loading={busy}
              />
              <NeonButton
                label="Back To Title"
                variant="ghost"
                size="md"
                fullWidth
                onPress={handleBackToTitle}
                disabled={busy}
                style={styles.secondaryBtn}
              />
            </View>
          </PixelPanel>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(3,1,10,0.96)",
    justifyContent: "center",
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Platform.OS === "web" ? 24 : 16,
    paddingVertical: 24,
  },
  card: {
    paddingVertical: 24,
    paddingHorizontal: 22,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
  },
  kicker: {
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 12,
    letterSpacing: 2,
    lineHeight: 24,
  },
  subhead: {
    marginTop: 14,
    lineHeight: 14,
  },
  divider: {
    marginTop: 18,
    marginBottom: 14,
    height: 2,
    backgroundColor: cfPalette.purple,
  },
  beatLabel: {
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  beat: {
    lineHeight: 14,
  },
  deductionBlock: {
    marginTop: 18,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 6,
    gap: 8,
  },
  bulletText: {
    flex: 1,
    lineHeight: 13,
  },
  truthBlock: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: cfPalette.iron,
  },
  actions: {
    marginTop: 22,
    gap: 10,
  },
  secondaryBtn: {
    marginTop: 4,
  },
});
