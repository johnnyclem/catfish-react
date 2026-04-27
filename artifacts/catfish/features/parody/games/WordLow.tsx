/**
 * Word-Low — Wordle parody mini-game.
 *
 * Ports the user's `WordLow` draft to React Native. Mechanics:
 *
 *   - 6 × 5 letter grid; per-letter feedback colors after every
 *     submitted guess (correct / present / absent).
 *   - Custom QWERTY keyboard rendered as `Pressable`s — no platform
 *     IME, so the game also works fine inside the touchscreen-only
 *     Apps tab without summoning the system keyboard.
 *   - Target word is picked from the 10-word `BUZZWORDS` list. The
 *     pick is date-seeded so a single calendar day surfaces the
 *     same word across cold starts; "Try Again" re-seeds with a
 *     pseudo-random offset so a replay can land on a different word.
 *   - Win streak persists in `parody.wordLowBestStreak` on the store
 *     and is announced on the win overlay.
 *   - SFX: `swipe_pass` on a key tap, `match` on a win, `lose` on
 *     loss — all through the existing `audioEvents.emitSfx` bus.
 */
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useGameState } from "@/core/gameStore";
import { emitSfx } from "@/features/audio/audioEvents";

const BUZZWORDS = [
  "GHOST",
  "TOXIC",
  "CLOUT",
  "VIBES",
  "FLAKE",
  "MATCH",
  "SHADE",
  "BREAD",
  "GASLY",
  "CRUSH",
];

type CellState = "empty" | "absent" | "present" | "correct" | "filled";

interface Props {
  onExit: () => void;
}

function dateSeed(offset = 0): number {
  const d = new Date();
  // YYYY*1e4 + MM*1e2 + DD — stable per calendar day.
  const seed =
    d.getFullYear() * 10_000 + (d.getMonth() + 1) * 100 + d.getDate();
  return (seed + offset) % BUZZWORDS.length;
}

export function WordLow({ onExit }: Props) {
  // Streak counter is local to this playthrough — once the player
  // exits the app it resets. The persistent best is recorded after
  // every win so a hot streak survives even if the player loses
  // their next round.
  const [targetWord, setTargetWord] = useState<string>(
    () => BUZZWORDS[dateSeed()] ?? "GHOST",
  );
  const [seedOffset, setSeedOffset] = useState(0);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [gameState, setGameState] = useState<"PLAYING" | "WON" | "LOST">(
    "PLAYING",
  );
  const streakRef = useRef(0);
  const recordParodyScore = useGameState((s) => s.recordParodyScore);
  const bestStreak = useGameState((s) => s.parody.wordLowBestStreak);

  useEffect(() => {
    if (gameState === "WON") {
      streakRef.current += 1;
      void recordParodyScore("wordLow", streakRef.current);
      emitSfx("match");
    } else if (gameState === "LOST") {
      streakRef.current = 0;
      emitSfx("lose");
    }
  }, [gameState, recordParodyScore]);

  function onKeyPress(key: string) {
    if (gameState !== "PLAYING") return;
    emitSfx("swipe_pass");
    if (key === "ENTER") {
      if (currentGuess.length !== 5) return;
      const next = [...guesses, currentGuess];
      setGuesses(next);
      if (currentGuess === targetWord) {
        setGameState("WON");
      } else if (next.length >= 6) {
        setGameState("LOST");
      }
      setCurrentGuess("");
      return;
    }
    if (key === "DEL") {
      setCurrentGuess((p) => p.slice(0, -1));
      return;
    }
    if (currentGuess.length < 5 && /^[A-Z]$/.test(key)) {
      setCurrentGuess((p) => p + key);
    }
  }

  function replay() {
    const nextOffset = seedOffset + 1;
    setSeedOffset(nextOffset);
    setTargetWord(BUZZWORDS[dateSeed(nextOffset)] ?? "GHOST");
    setGuesses([]);
    setCurrentGuess("");
    setGameState("PLAYING");
  }

  function evalLetter(letter: string, pos: number): CellState {
    if (!letter) return "empty";
    if (targetWord[pos] === letter) return "correct";
    if (targetWord.includes(letter)) return "present";
    return "absent";
  }

  return (
    <View style={styles.root}>
      {/* Smoky ambient gradient */}
      <View pointerEvents="none" style={styles.smoke} />
      <View style={styles.header}>
        <Text style={styles.title}>Word-Low</Text>
        <Text style={styles.subtitle}>POSER CHECK: ON</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.gridArea}
        showsVerticalScrollIndicator={false}
      >
        {Array.from({ length: 6 }).map((_, i) => {
          const guess =
            guesses[i] ?? (i === guesses.length ? currentGuess : "");
          const submitted = i < guesses.length;
          return (
            <View key={i} style={styles.gridRow}>
              {Array.from({ length: 5 }).map((__, j) => {
                const ch = guess[j] ?? "";
                const state: CellState = submitted
                  ? evalLetter(ch, j)
                  : ch
                    ? "filled"
                    : "empty";
                return (
                  <View
                    key={j}
                    testID={`wordlow-cell-${i}-${j}`}
                    style={[styles.cell, cellStyle(state)]}
                  >
                    <Text style={styles.cellText}>{ch}</Text>
                  </View>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.keyboard}>
        {KEYBOARD_ROWS.map((row, ri) => (
          <View key={ri} style={styles.keyRow}>
            {ri === 2 ? (
              <Pressable
                testID="wordlow-key-ENTER"
                onPress={() => onKeyPress("ENTER")}
                style={({ pressed }) => [
                  styles.keyWide,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.keyWideLabel}>ENTER</Text>
              </Pressable>
            ) : null}
            {row.split("").map((k) => (
              <Pressable
                key={k}
                testID={`wordlow-key-${k}`}
                onPress={() => onKeyPress(k)}
                style={({ pressed }) => [
                  styles.key,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.keyLabel}>{k}</Text>
              </Pressable>
            ))}
            {ri === 2 ? (
              <Pressable
                testID="wordlow-key-DEL"
                onPress={() => onKeyPress("DEL")}
                style={({ pressed }) => [
                  styles.keyWide,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.keyWideLabel, { color: "#f87171" }]}>
                  DEL
                </Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>

      {gameState !== "PLAYING" ? (
        <View style={styles.overlay}>
          <Text
            style={[
              styles.overlayHeadline,
              { color: gameState === "WON" ? "#14b8a6" : "#dc2626" },
            ]}
          >
            {gameState === "WON" ? "CERTIFIED" : "EXPOSED"}
          </Text>
          <Text style={styles.overlayBody}>
            {gameState === "WON"
              ? `You actually belong here. The word was ${targetWord}.`
              : `You're a poser. Everyone knows the word was ${targetWord}.`}
          </Text>
          {gameState === "WON" ? (
            <Text style={styles.overlayMeta}>
              {`Streak: ${streakRef.current}  ·  Best: ${Math.max(streakRef.current, bestStreak)}`}
            </Text>
          ) : null}
          <Pressable
            testID="wordlow-replay"
            onPress={replay}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.primaryBtnLabel}>REPLAY</Text>
          </Pressable>
          <Pressable
            testID="wordlow-home"
            onPress={onExit}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.secondaryBtnLabel}>HOME</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const KEYBOARD_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

function cellStyle(state: CellState) {
  switch (state) {
    case "correct":
      return {
        backgroundColor: "#14b8a6",
        borderColor: "#2dd4bf",
      };
    case "present":
      return {
        backgroundColor: "#d97706",
        borderColor: "#f59e0b",
      };
    case "absent":
      return {
        backgroundColor: "#27272a",
        borderColor: "#3f3f46",
      };
    case "filled":
      return {
        backgroundColor: "#18181b",
        borderColor: "#52525b",
      };
    case "empty":
    default:
      return {
        backgroundColor: "#09090b",
        borderColor: "#27272a",
      };
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#09090b",
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  smoke: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: "#27272a",
    marginBottom: 14,
  },
  title: {
    color: "white",
    fontSize: 22,
    fontWeight: "900",
    fontStyle: "italic",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  subtitle: {
    color: "#71717a",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  gridArea: {
    paddingVertical: 4,
    gap: 8,
  },
  gridRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  cell: {
    width: 46,
    height: 46,
    borderWidth: 2,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: {
    color: "white",
    fontSize: 22,
    fontWeight: "900",
  },
  keyboard: {
    paddingTop: 14,
    paddingBottom: 8,
    gap: 6,
  },
  keyRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  key: {
    width: 28,
    height: 38,
    borderRadius: 6,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    alignItems: "center",
    justifyContent: "center",
  },
  keyLabel: {
    color: "white",
    fontSize: 12,
    fontWeight: "800",
  },
  keyWide: {
    height: 38,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#27272a",
    alignItems: "center",
    justifyContent: "center",
  },
  keyWideLabel: {
    color: "white",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  overlayHeadline: {
    fontSize: 48,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: 1,
    marginBottom: 14,
    textTransform: "uppercase",
  },
  overlayBody: {
    color: "#a1a1aa",
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 14,
    lineHeight: 16,
  },
  overlayMeta: {
    color: "#71717a",
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 18,
  },
  primaryBtn: {
    width: "100%",
    backgroundColor: "white",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  primaryBtnLabel: {
    color: "black",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
  },
  secondaryBtn: {
    width: "100%",
    backgroundColor: "#27272a",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  secondaryBtnLabel: {
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
  },
});
