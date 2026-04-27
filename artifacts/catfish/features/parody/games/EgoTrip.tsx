/**
 * Ego Trip — Flappy Bird parody mini-game.
 *
 * Mechanics from the user's `EgoTrip` draft:
 *
 *   - Tap-to-flap "ego" avatar (zinc square with neon trim).
 *     Constant gravity, a fixed jump-strength impulse on each tap.
 *   - "FAIL" pillar pairs scroll in from the right at fixed
 *     intervals. Score ticks once each pair is passed.
 *   - States: READY (start card) → COUNTDOWN (3-2-1) → PLAYING →
 *     GAME_OVER ("BURNOUT" red sting, retry/home).
 *   - Game loop is `requestAnimationFrame`-driven rather than
 *     `setInterval` so it stays in sync with the platform's
 *     compositor. All per-frame state lives in `useRef`s — React
 *     state is only the discrete game phase + the score, so we
 *     don't trigger a render every 16ms.
 *   - High score persists in `parody.egoTripHighScore`.
 *   - SFX: `swipe_like` on flap, `lose` on burnout, `match` on a
 *     new high score (only when strictly higher than the previous
 *     best, so re-clearing the same score doesn't re-fire).
 */
import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useGameState } from "@/core/gameStore";
import { EgoTripSession, todayDateKey } from "@/core/parodySessions";
import { emitSfx } from "@/features/audio/audioEvents";

interface Props {
  onExit: () => void;
}

const GRAVITY = 0.45;
const JUMP_VELOCITY = -8;
const SCROLL_SPEED = 2.4;
const PILLAR_GAP = 200; // vertical opening between top + bottom pillar
const PILLAR_WIDTH = 60;
const SPAWN_INTERVAL_MS = 1800;
const BIRD_SIZE = 36;

interface Pillar {
  id: number;
  x: number;
  topHeight: number;
  passed: boolean;
}

type Phase = "READY" | "COUNTDOWN" | "PLAYING" | "GAME_OVER";

export function EgoTrip({ onExit }: Props) {
  const [phase, setPhase] = useState<Phase>("READY");
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState(0);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const confirmingRestartRef = useRef(false);
  // Fresh-start confirm — Task #49. Guards the FRESH START button on
  // the READY card from accidentally wiping a same-day saved run.
  // Only used when `resumeRef.current` is non-null; without a saved
  // run the READY card has no FRESH START button at all.
  const [showFreshStartConfirm, setShowFreshStartConfirm] = useState(false);

  // Per-frame mutable state — we render it via direct style writes
  // (translated through React state on every animation tick) but
  // keep the source of truth in refs so no React re-render fires
  // per millisecond.
  const birdYRef = useRef(0);
  const velocityRef = useRef(0);
  const pillarsRef = useRef<Pillar[]>([]);
  const lastSpawnRef = useRef(0);
  const fieldHeightRef = useRef(0);
  const fieldWidthRef = useRef(0);
  const phaseRef = useRef<Phase>("READY");
  const rafRef = useRef<number | null>(null);
  const scoreRef = useRef(0);
  const tickRef = useRef(0);

  // Mirror state into refs so the rAF loop reads the latest phase
  // without recreating the loop callback on every render.
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    confirmingRestartRef.current = showRestartConfirm;
  }, [showRestartConfirm]);

  const recordParodyScore = useGameState((s) => s.recordParodyScore);
  const saveEgoTripSession = useGameState((s) => s.saveEgoTripSession);
  const bestEgo = useGameState((s) => s.parody.egoTripHighScore);
  const bestEgoRef = useRef(bestEgo);
  useEffect(() => {
    bestEgoRef.current = bestEgo;
  }, [bestEgo]);
  // Same-day session for Task #44. Snapshot is taken at mount —
  // the READY card uses it to render a RESUME affordance, after
  // which the ref is cleared so the player isn't re-prompted.
  // We don't carry physics (bird Y / velocity) across launches —
  // restoring mid-flight would feel like teleporting; restoring at
  // the score with a fresh, mid-field bird is the kind player
  // experience.
  const hydratedEgoSession = useGameState.getState().parodySessions.egoTrip;
  const resumeRef = useRef<EgoTripSession | null>(hydratedEgoSession);
  // Score the player resumed at, queued so the COUNTDOWN→PLAYING
  // transition can re-apply it AFTER `reset()` zeros things out.
  // We can't just stuff the score into `scoreRef` at button-press
  // time because the countdown handler unconditionally calls
  // `reset()` before flipping to PLAYING — that's load-bearing for
  // physics (the bird needs to be re-centered and the pillar list
  // must be empty), so the cleanest fix is to re-apply the score
  // after reset, not skip reset.
  const pendingResumeScoreRef = useRef<number | null>(null);

  // Force re-render at 60fps so absolute positions follow the refs.
  const [, setRenderTick] = useState(0);

  const onFieldLayout = useCallback((e: LayoutChangeEvent) => {
    fieldHeightRef.current = e.nativeEvent.layout.height;
    fieldWidthRef.current = e.nativeEvent.layout.width;
    if (birdYRef.current === 0) {
      birdYRef.current = Math.max(0, fieldHeightRef.current / 2 - BIRD_SIZE / 2);
    }
  }, []);

  const reset = useCallback(() => {
    birdYRef.current = Math.max(
      0,
      fieldHeightRef.current / 2 - BIRD_SIZE / 2,
    );
    velocityRef.current = 0;
    pillarsRef.current = [];
    lastSpawnRef.current = 0;
    scoreRef.current = 0;
    setScore(0);
  }, []);

  const tick = useCallback((time: number) => {
    if (phaseRef.current !== "PLAYING" || confirmingRestartRef.current) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const fieldH = fieldHeightRef.current;
    const fieldW = fieldWidthRef.current;
    if (fieldH <= 0 || fieldW <= 0) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    velocityRef.current += GRAVITY;
    birdYRef.current += velocityRef.current;

    // Floor / ceiling collide → burnout
    if (
      birdYRef.current + BIRD_SIZE >= fieldH ||
      birdYRef.current <= 0
    ) {
      birdYRef.current = Math.min(
        Math.max(0, birdYRef.current),
        fieldH - BIRD_SIZE,
      );
      crash();
      // Keep the rAF chain alive — once phase flips to GAME_OVER the
      // early-return at the top of `tick` will idle the loop. If we
      // returned here without scheduling, the loop would die and the
      // player's RETRY would re-enter PLAYING with no driver, freezing
      // the bird mid-air.
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    // Spawn next pillar pair
    if (time - lastSpawnRef.current > SPAWN_INTERVAL_MS) {
      const minTop = 50;
      const maxTop = Math.max(minTop + 1, fieldH - PILLAR_GAP - 50);
      const topHeight =
        minTop + Math.floor(Math.random() * (maxTop - minTop));
      pillarsRef.current = [
        ...pillarsRef.current,
        { id: time, x: fieldW, topHeight, passed: false },
      ];
      lastSpawnRef.current = time;
    }

    // Move pillars + collision + scoring
    const birdLeft = 60;
    const birdRight = birdLeft + BIRD_SIZE;
    const birdTop = birdYRef.current;
    const birdBottom = birdTop + BIRD_SIZE;

    let didCrash = false;
    pillarsRef.current = pillarsRef.current
      .map((p) => ({ ...p, x: p.x - SCROLL_SPEED }))
      .filter((p) => p.x + PILLAR_WIDTH > 0)
      .map((p) => {
        const pLeft = p.x;
        const pRight = p.x + PILLAR_WIDTH;
        const overlapsX = birdRight > pLeft && birdLeft < pRight;
        if (overlapsX) {
          const gapTop = p.topHeight;
          const gapBottom = p.topHeight + PILLAR_GAP;
          if (birdTop < gapTop || birdBottom > gapBottom) {
            didCrash = true;
          }
        }
        if (!p.passed && pRight < birdLeft) {
          scoreRef.current += 1;
          setScore(scoreRef.current);
          // Snapshot every passed pillar — that's the player's only
          // unit of progress here, and the rate is naturally low
          // (~1 write per ~2s of survival) so AsyncStorage stays
          // happy. We capture the score only; physics intentionally
          // resets to a mid-field bird on resume.
          void saveEgoTripSession({
            dateKey: todayDateKey(),
            score: scoreRef.current,
          });
          return { ...p, passed: true };
        }
        return p;
      });

    if (didCrash) {
      crash();
      // Keep the rAF chain alive — see comment on the floor/ceiling
      // crash path above. Without this, the loop would die and RETRY
      // would never re-drive physics after a pillar collision.
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    tickRef.current += 1;
    if (tickRef.current % 2 === 0) {
      // Re-render at ~30fps to keep React reconciliation cheap.
      setRenderTick((t) => t + 1);
    }
    rafRef.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function crash() {
    emitSfx("lose");
    if (scoreRef.current > bestEgoRef.current) {
      void recordParodyScore("egoTrip", scoreRef.current).then((bumped) => {
        if (bumped) emitSfx("match");
      });
    }
    // The run is over — the in-progress snapshot would now mislead
    // the next launch into offering a "resume" of a finished run.
    void saveEgoTripSession(null);
    setPhase("GAME_OVER");
  }

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [tick]);

  // 3-2-1 countdown timer
  useEffect(() => {
    if (phase !== "COUNTDOWN") return;
    setCountdown(3);
    let n = 3;
    const id = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(id);
        reset();
        // If the player resumed, re-apply their score after reset()
        // wipes it. Without this the resumed score would silently
        // be lost the moment the countdown completes — a regression
        // the unit test for the store wouldn't catch because the
        // store *does* hold the right value; only the in-game
        // counter forgets.
        if (pendingResumeScoreRef.current != null) {
          scoreRef.current = pendingResumeScoreRef.current;
          setScore(pendingResumeScoreRef.current);
          pendingResumeScoreRef.current = null;
        }
        setPhase("PLAYING");
      } else {
        setCountdown(n);
      }
    }, 700);
    return () => clearInterval(id);
  }, [phase, reset]);

  function handleTap() {
    // Swallow taps on the field while the restart confirmation is up
    // so the user doesn't accidentally flap or skip the prompt.
    if (showRestartConfirm) return;
    // When a resume offer is on screen, tap-to-flap is suppressed
    // so the player can hit the explicit RESUME / FRESH START
    // buttons without accidentally starting a fresh run.
    if (phase === "READY" && resumeRef.current) return;
    if (phase === "READY" || phase === "GAME_OVER") {
      reset();
      setPhase("COUNTDOWN");
      return;
    }
    if (phase === "PLAYING") {
      velocityRef.current = JUMP_VELOCITY;
      emitSfx("swipe_like");
    }
  }

  return (
    <Pressable
      testID="egotrip-field"
      onPress={handleTap}
      style={styles.root}
      onLayout={onFieldLayout}
    >
      {/* Sky gradient as flat colors — keeps the file dependency-free */}
      <View style={[StyleSheet.absoluteFill, styles.sky]} />

      <View style={styles.scoreBar} pointerEvents="box-none">
        <Text style={styles.scoreText}>EGO: {score}</Text>
        <View style={styles.scoreBarRight} pointerEvents="box-none">
          <Text style={styles.bestText}>BEST: {Math.max(bestEgo, score)}</Text>
          {phase === "PLAYING" ? (
            <Pressable
              testID="egotrip-restart"
              accessibilityLabel="Restart run"
              hitSlop={10}
              onPress={(e) => {
                e.stopPropagation?.();
                setShowRestartConfirm(true);
              }}
              style={({ pressed }) => [
                styles.restartBtn,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Feather name="rotate-ccw" size={14} color="white" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {pillarsRef.current.map((p) => (
        <View
          key={p.id}
          style={{
            position: "absolute",
            left: p.x,
            width: PILLAR_WIDTH,
            top: 0,
            bottom: 0,
          }}
          pointerEvents="none"
        >
          <View
            style={{
              height: p.topHeight,
              backgroundColor: "#09090b",
              borderBottomWidth: 4,
              borderBottomColor: "#3f3f46",
            }}
          />
          <View style={{ flex: 1 }} />
          <View
            style={{
              position: "absolute",
              top: p.topHeight + PILLAR_GAP,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "#09090b",
              borderTopWidth: 4,
              borderTopColor: "#3f3f46",
            }}
          />
          <Text style={styles.pillarLabel}>FAIL</Text>
        </View>
      ))}

      <View
        style={[
          styles.bird,
          {
            top: birdYRef.current,
          },
        ]}
        pointerEvents="none"
      />

      {phase === "READY" ? (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.cardHeadline}>EGO TRIP</Text>
            <Text style={styles.cardBody}>
              {resumeRef.current ? "PICK UP WHERE YOU LEFT OFF?" : "TAP TO FLAP"}
            </Text>
            <Text style={styles.cardMeta}>BEST: {bestEgo}</Text>
            {/* Same-day RESUME — Task #44. Resuming preloads the
                score; physics start fresh mid-field via `reset()`,
                which feels less jarring than re-spawning the bird at
                some past Y/velocity. */}
            {resumeRef.current ? (
              <>
                <Pressable
                  testID="egotrip-resume"
                  onPress={(e) => {
                    e.stopPropagation?.();
                    const snap = resumeRef.current;
                    if (!snap) return;
                    // Queue the resumed score; the COUNTDOWN→PLAYING
                    // transition's `reset()` would clobber it if we
                    // applied it inline here.
                    pendingResumeScoreRef.current = snap.score;
                    resumeRef.current = null;
                    setPhase("COUNTDOWN");
                  }}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={styles.primaryBtnLabel}>
                    {`RESUME · ${resumeRef.current.score}`}
                  </Text>
                </Pressable>
                <Pressable
                  testID="egotrip-fresh"
                  onPress={(e) => {
                    e.stopPropagation?.();
                    // Task #49 — confirm before discarding a saved
                    // same-day run. Without the prompt a stray tap
                    // here throws away real progress with no undo.
                    setShowFreshStartConfirm(true);
                  }}
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={styles.secondaryBtnLabel}>FRESH START</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      ) : null}

      {phase === "COUNTDOWN" ? (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.countdown}>{countdown}</Text>
        </View>
      ) : null}

      {showFreshStartConfirm && phase === "READY" && resumeRef.current ? (
        <Pressable
          style={styles.overlay}
          onPress={(e) => e.stopPropagation?.()}
        >
          <View style={styles.card}>
            <Text style={styles.cardHeadline}>END SAVED RUN?</Text>
            <Text style={styles.cardBody}>
              {`THIS WILL WIPE YOUR SAVED EGO ${resumeRef.current.score}.`}
            </Text>
            <Pressable
              testID="egotrip-fresh-confirm"
              onPress={(e) => {
                e.stopPropagation?.();
                resumeRef.current = null;
                void saveEgoTripSession(null);
                reset();
                setShowFreshStartConfirm(false);
                setPhase("COUNTDOWN");
              }}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.primaryBtnLabel}>START FRESH</Text>
            </Pressable>
            <Pressable
              testID="egotrip-fresh-cancel"
              onPress={(e) => {
                e.stopPropagation?.();
                setShowFreshStartConfirm(false);
              }}
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.secondaryBtnLabel}>KEEP SAVED RUN</Text>
            </Pressable>
          </View>
        </Pressable>
      ) : null}

      {showRestartConfirm && phase === "PLAYING" ? (
        <Pressable
          style={styles.overlay}
          onPress={(e) => e.stopPropagation?.()}
        >
          <View style={styles.card}>
            <Text style={styles.cardHeadline}>RESTART RUN?</Text>
            <Text style={styles.cardBody}>SCORE AND PILLARS RESET.</Text>
            <Pressable
              testID="egotrip-restart-confirm"
              onPress={(e) => {
                e.stopPropagation?.();
                setShowRestartConfirm(false);
                reset();
                setPhase("COUNTDOWN");
              }}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.primaryBtnLabel}>RESTART</Text>
            </Pressable>
            <Pressable
              testID="egotrip-restart-cancel"
              onPress={(e) => {
                e.stopPropagation?.();
                setShowRestartConfirm(false);
              }}
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.secondaryBtnLabel}>KEEP PLAYING</Text>
            </Pressable>
          </View>
        </Pressable>
      ) : null}

      {phase === "GAME_OVER" ? (
        <View style={styles.overlay}>
          <Text style={styles.gameOverHeadline}>BURNOUT</Text>
          <Text style={styles.gameOverBody}>
            Ego: {score} · Best: {Math.max(bestEgo, score)}
          </Text>
          <Pressable
            testID="egotrip-replay"
            onPress={(e) => {
              e.stopPropagation?.();
              reset();
              setPhase("COUNTDOWN");
            }}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.primaryBtnLabel}>REPLAY</Text>
          </Pressable>
          <Pressable
            testID="egotrip-home"
            onPress={(e) => {
              e.stopPropagation?.();
              onExit();
            }}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.secondaryBtnLabel}>HOME</Text>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1e1b4b",
    overflow: "hidden",
  },
  sky: {
    backgroundColor: "#312e81",
  },
  scoreBar: {
    position: "absolute",
    top: 16,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    zIndex: 10,
  },
  scoreText: {
    color: "white",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
  },
  bestText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  scoreBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  restartBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  pillarLabel: {
    position: "absolute",
    color: "#f87171",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    bottom: 8,
    alignSelf: "center",
    transform: [{ rotate: "-90deg" }],
  },
  bird: {
    position: "absolute",
    left: 60,
    width: BIRD_SIZE,
    height: BIRD_SIZE,
    backgroundColor: "#18181b",
    borderWidth: 2,
    borderColor: "#22e0ff",
    borderRadius: 6,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  card: {
    backgroundColor: "#18181b",
    borderRadius: 18,
    padding: 28,
    alignItems: "center",
    gap: 8,
  },
  cardHeadline: {
    color: "white",
    fontSize: 24,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: 1,
  },
  cardBody: {
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    marginTop: 4,
  },
  cardMeta: {
    color: "#71717a",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginTop: 4,
  },
  countdown: {
    color: "white",
    fontSize: 96,
    fontWeight: "900",
    fontStyle: "italic",
  },
  gameOverHeadline: {
    color: "#dc2626",
    fontSize: 56,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: 1,
    marginBottom: 18,
  },
  gameOverBody: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 24,
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
