/**
 * Sugar Coat — match-3 parody mini-game.
 *
 * Builds on the user's `SugarCoat` skeleton (which had only a static
 * pink/blue tile grid) by adding the missing match-3 logic:
 *
 *   - 3 gem types: Lie (pink heart), Excuse (blue chat bubble),
 *     Spin (purple lightning bolt). Three gives 3-in-a-row a real
 *     constraint without exploding the chain math.
 *   - Tap-then-tap to swap two adjacent gems; non-adjacent or
 *     same-type-after-swap selections are rejected.
 *   - After a swap, scan horizontal + vertical 3+-in-a-row, clear
 *     matches, cascade gems down, refill from the top, repeat
 *     until stable.
 *   - Each cleared gem awards CLOUT; chain combos multiply.
 *   - Move counter starts at 20; OUT OF CLOUT overlay on hitting 0.
 *   - Best CLOUT persists in `parody.sugarCoatHighClout`.
 *   - SFX: `fact_filed` swap, `swipe_like` clear, `match` chain ≥ 3,
 *     `lose` game over.
 *
 * The board is intentionally seeded *after* a guaranteed
 * no-immediate-match scan so the player isn't credited with score
 * before they've made a move; refills can still produce cascades on
 * a real swap.
 */
import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useGameState } from "@/core/gameStore";
import { SugarCoatSession, todayDateKey } from "@/core/parodySessions";
import { emitSfx } from "@/features/audio/audioEvents";

interface Props {
  onExit: () => void;
}

// Board dimension. If you change this, update `SUGAR_COAT_BOARD_CELLS`
// in `core/parodySessions.ts` in the same commit — the parser uses
// that constant to reject malformed restored boards.
const SIZE = 7;
const STARTING_MOVES = 20;

type GemKind = "lie" | "excuse" | "spin";

interface GemSpec {
  kind: GemKind;
  color: string;
  icon: React.ComponentProps<typeof Feather>["name"];
}

const GEM_SPECS: Record<GemKind, GemSpec> = {
  lie: { kind: "lie", color: "#ec4899", icon: "heart" },
  excuse: { kind: "excuse", color: "#60a5fa", icon: "message-circle" },
  spin: { kind: "spin", color: "#a78bfa", icon: "zap" },
};

const KINDS: GemKind[] = ["lie", "excuse", "spin"];

function randomKind(): GemKind {
  const idx = Math.floor(Math.random() * KINDS.length);
  return KINDS[idx] ?? "lie";
}

/**
 * Generate a starting board with no pre-existing 3-in-a-rows so the
 * player's score begins at zero and every match is the result of a
 * deliberate swap.
 */
function freshBoard(): GemKind[] {
  const board: GemKind[] = new Array(SIZE * SIZE);
  for (let i = 0; i < board.length; i++) {
    let pick = randomKind();
    let attempts = 0;
    // Reroll if it would create an immediate 3-in-a-row to the left
    // or above. Capped so a degenerate sequence can't loop forever.
    while (attempts < 6 && createsRunAt(board, i, pick)) {
      pick = randomKind();
      attempts += 1;
    }
    board[i] = pick;
  }
  return board;
}

function createsRunAt(board: GemKind[], idx: number, pick: GemKind): boolean {
  const r = Math.floor(idx / SIZE);
  const c = idx % SIZE;
  if (
    c >= 2 &&
    board[idx - 1] === pick &&
    board[idx - 2] === pick
  ) {
    return true;
  }
  if (
    r >= 2 &&
    board[idx - SIZE] === pick &&
    board[idx - 2 * SIZE] === pick
  ) {
    return true;
  }
  return false;
}

function findMatches(board: GemKind[]): Set<number> {
  const out = new Set<number>();
  // Rows
  for (let r = 0; r < SIZE; r++) {
    let runStart = 0;
    for (let c = 1; c <= SIZE; c++) {
      const here = c < SIZE ? board[r * SIZE + c] : null;
      const prev = board[r * SIZE + c - 1];
      if (here !== prev) {
        const len = c - runStart;
        if (len >= 3) {
          for (let k = 0; k < len; k++) out.add(r * SIZE + runStart + k);
        }
        runStart = c;
      }
    }
  }
  // Columns
  for (let c = 0; c < SIZE; c++) {
    let runStart = 0;
    for (let r = 1; r <= SIZE; r++) {
      const here = r < SIZE ? board[r * SIZE + c] : null;
      const prev = board[(r - 1) * SIZE + c];
      if (here !== prev) {
        const len = r - runStart;
        if (len >= 3) {
          for (let k = 0; k < len; k++)
            out.add((runStart + k) * SIZE + c);
        }
        runStart = r;
      }
    }
  }
  return out;
}

/**
 * Apply gravity: nulls in `board` (cleared cells) bubble up; gems
 * fall down; new random gems fill the top. Returns a fresh array.
 */
function cascade(board: (GemKind | null)[]): GemKind[] {
  const next = [...board];
  for (let c = 0; c < SIZE; c++) {
    const column: GemKind[] = [];
    for (let r = SIZE - 1; r >= 0; r--) {
      const v = next[r * SIZE + c];
      if (v) column.push(v);
    }
    while (column.length < SIZE) column.push(randomKind());
    for (let r = 0; r < SIZE; r++) {
      next[(SIZE - 1 - r) * SIZE + c] = column[r] ?? randomKind();
    }
  }
  return next as GemKind[];
}

function isAdjacent(a: number, b: number): boolean {
  const ra = Math.floor(a / SIZE);
  const ca = a % SIZE;
  const rb = Math.floor(b / SIZE);
  const cb = b % SIZE;
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
}

export function SugarCoat({ onExit }: Props) {
  // Same-day session restore — Task #44. Unlike SafeSpot/EgoTrip,
  // SugarCoat has no READY phase, so we restore *silently* on mount.
  // The store's hydrate() has already loaded any same-day snapshot;
  // a stale (non-today) one was dropped by the parser. We grab via
  // `useGameState.getState()` rather than `useGameState((s) => …)`
  // so subsequent persists from this same component don't trigger a
  // re-render of these initial-state seeders.
  const initialSession = useGameState.getState().parodySessions.sugarCoat;
  const [board, setBoard] = useState<GemKind[]>(() =>
    initialSession ? initialSession.board : freshBoard(),
  );
  const [score, setScore] = useState(initialSession?.score ?? 0);
  const [moves, setMoves] = useState(initialSession?.moves ?? STARTING_MOVES);
  const [selected, setSelected] = useState<number | null>(null);
  const [phase, setPhase] = useState<"PLAYING" | "GAME_OVER">("PLAYING");
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  // Task #49 — dedicated "Start over" affordance for a saved board.
  // Unlike the generic in-game restart (which is always available),
  // this button only surfaces when the player landed on a board that
  // was hydrated from a same-day snapshot, so it specifically warns
  // about discarding *saved* progress (not the in-progress run a
  // fresh restart would).
  const wasRestoredRef = useRef<boolean>(initialSession != null);
  const [, setForceRender] = useState(0);
  const [showFreshStartConfirm, setShowFreshStartConfirm] = useState(false);
  const recordParodyScore = useGameState((s) => s.recordParodyScore);
  const saveSugarCoatSession = useGameState((s) => s.saveSugarCoatSession);
  const bestClout = useGameState((s) => s.parody.sugarCoatHighClout);
  const recordedRef = useRef(false);
  const resolvingRef = useRef(false);
  // Mirror score & moves into refs so the post-cascade scheduleTimeout
  // can read the up-to-date values without recreating its closure.
  // (`setScore`'s functional updater means the *state* is correct, but
  // the inline `score` variable in the closure would still be stale.)
  const scoreRef = useRef(score);
  const movesRef = useRef(moves);
  const boardRef = useRef(board);
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);
  useEffect(() => {
    movesRef.current = moves;
  }, [moves]);
  useEffect(() => {
    boardRef.current = board;
  }, [board]);
  // Track in-flight setTimeout handles so we can cancel them on
  // unmount — otherwise a player who exits to the home grid mid-swap
  // would trigger a setState on an unmounted component when the
  // 180ms resolve / 250ms game-over deferral fires.
  const pendingTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(
    new Set(),
  );

  function scheduleTimeout(fn: () => void, ms: number): void {
    const handle = setTimeout(() => {
      pendingTimeoutsRef.current.delete(handle);
      fn();
    }, ms);
    pendingTimeoutsRef.current.add(handle);
  }

  useEffect(() => {
    return () => {
      for (const h of pendingTimeoutsRef.current) clearTimeout(h);
      pendingTimeoutsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (phase === "GAME_OVER" && !recordedRef.current) {
      recordedRef.current = true;
      emitSfx("lose");
      void recordParodyScore("sugarCoat", score).then((bumped) => {
        if (bumped) emitSfx("match");
      });
      // The run is finished — drop the in-progress snapshot so a
      // future cold-start doesn't silently restore a board with
      // 0 moves left.
      void saveSugarCoatSession(null);
    }
  }, [phase, score, recordParodyScore, saveSugarCoatSession]);

  function reset() {
    // Cancel any in-flight resolve / game-over deferrals from the
    // previous run. Without this, a restart triggered inside the 250ms
    // game-over deferral window (or the 180ms resolve window) would
    // let a stale setTimeout fire on the fresh board, immediately
    // flipping the new run to GAME_OVER or leaving `resolvingRef`
    // stuck true.
    for (const h of pendingTimeoutsRef.current) clearTimeout(h);
    pendingTimeoutsRef.current.clear();
    resolvingRef.current = false;
    setShowRestartConfirm(false);
    setShowFreshStartConfirm(false);
    setBoard(freshBoard());
    setScore(0);
    setMoves(STARTING_MOVES);
    setSelected(null);
    setPhase("PLAYING");
    recordedRef.current = false;
    // The new run is fresh, so the dedicated "Start over" affordance
    // shouldn't reappear. `useRef` writes don't re-render, so force a
    // sibling render via `setForceRender` so the header's restored-
    // run pill drops out of the tree.
    if (wasRestoredRef.current) {
      wasRestoredRef.current = false;
      setForceRender((n) => n + 1);
    }
    // Replay button: discard any pending session so we don't
    // accidentally re-restore a stale board on the next cold start
    // (the next snapshot will be written after the player's first
    // settled swap of the new run).
    void saveSugarCoatSession(null);
  }

  /**
   * Apply a swap, then resolve cascading matches. Returns the total
   * gems cleared so the caller can refund a move on a no-op swap.
   */
  function applySwap(a: number, b: number): number {
    const swapped = [...board];
    const tmp = swapped[a]!;
    swapped[a] = swapped[b]!;
    swapped[b] = tmp;

    let cleared = 0;
    let chain = 0;
    let working: (GemKind | null)[] = swapped;
    let matches = findMatches(working as GemKind[]);
    if (matches.size === 0) {
      // Swap doesn't produce a match — revert without consuming a move.
      return 0;
    }
    while (matches.size > 0) {
      chain += 1;
      cleared += matches.size;
      for (const idx of matches) working[idx] = null;
      working = cascade(working);
      matches = findMatches(working as GemKind[]);
    }
    setBoard(working as GemKind[]);
    setScore((s) => {
      const next = s + cleared * 10 * Math.max(1, chain);
      return next;
    });
    if (chain >= 3) emitSfx("match");
    else emitSfx("swipe_like");
    return cleared;
  }

  function tap(idx: number) {
    if (phase !== "PLAYING" || resolvingRef.current) return;
    if (selected == null) {
      setSelected(idx);
      return;
    }
    if (selected === idx) {
      setSelected(null);
      return;
    }
    if (!isAdjacent(selected, idx)) {
      // Treat a tap on a non-adjacent cell as a re-selection.
      setSelected(idx);
      return;
    }
    // Adjacent — try the swap.
    resolvingRef.current = true;
    emitSfx("fact_filed");
    const cleared = applySwap(selected, idx);
    setSelected(null);
    if (cleared > 0) {
      const remaining = moves - 1;
      setMoves(remaining);
      if (remaining <= 0) {
        // Defer the game-over flip slightly so the final cascade
        // animates before the overlay covers the board.
        scheduleTimeout(() => setPhase("GAME_OVER"), 250);
      }
    }
    // Tiny delay before accepting the next tap so the user can see
    // the cleared chain. We also use this same boundary to snapshot
    // the *settled* post-cascade board — if we wrote it inside
    // `applySwap` the board state hasn't propagated through React
    // yet, and we'd persist the pre-cascade arrangement. By waiting
    // 180ms (long enough for `setBoard` to flush), the next mount
    // restores exactly what the player saw at the end of the swap.
    //
    // Skip the persist on a no-op swap (cleared === 0) — the board,
    // score, and remaining moves are unchanged, so writing would
    // just churn AsyncStorage.
    scheduleTimeout(() => {
      resolvingRef.current = false;
      if (cleared > 0 && movesRef.current > 0) {
        // Read everything from refs — state setters from `applySwap`
        // and the `setMoves(remaining)` above are queued through
        // React; the matching `useEffect` mirror-into-ref runs after
        // commit, so by the time this 180ms timeout fires the refs
        // hold the freshly-rendered values.
        const snap: SugarCoatSession = {
          dateKey: todayDateKey(),
          board: [...boardRef.current],
          score: scoreRef.current,
          moves: movesRef.current,
        };
        void saveSugarCoatSession(snap);
      }
    }, 180);
  }

  // Memo cells — the board re-renders only when the array changes.
  const cells = useMemo(
    () =>
      board.map((kind, idx) => ({
        idx,
        kind,
        spec: GEM_SPECS[kind],
      })),
    [board],
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Sugar Coat</Text>
        <View style={styles.headerRight}>
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>CLOUT</Text>
            <Text style={styles.statValue}>{score}</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>MOVES</Text>
            <Text style={styles.statValue}>{moves}</Text>
          </View>
          {phase === "PLAYING" && wasRestoredRef.current ? (
            <Pressable
              testID="sugarcoat-fresh"
              accessibilityLabel="Start over from saved board"
              onPress={() => setShowFreshStartConfirm(true)}
              hitSlop={10}
              style={({ pressed }) => [
                styles.freshBtn,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.freshBtnLabel}>START OVER</Text>
            </Pressable>
          ) : null}
          {phase === "PLAYING" ? (
            <Pressable
              testID="sugarcoat-restart"
              accessibilityLabel="Restart run"
              onPress={() => setShowRestartConfirm(true)}
              hitSlop={10}
              style={({ pressed }) => [
                styles.restartBtn,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Feather name="rotate-ccw" size={14} color="#a1a1aa" />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.boardWrap}>
        <View style={styles.board}>
          {cells.map((c) => {
            const isSel = selected === c.idx;
            return (
              <Pressable
                key={c.idx}
                testID={`sugarcoat-cell-${c.idx}`}
                onPress={() => tap(c.idx)}
                style={({ pressed }) => [
                  styles.cell,
                  {
                    backgroundColor: isSel ? "#27272a" : "#18181b",
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Feather
                  name={c.spec.icon}
                  color={c.spec.color}
                  size={18}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerLabel}>BEST CLOUT</Text>
        <Text style={styles.footerValue}>{Math.max(bestClout, score)}</Text>
      </View>

      {showFreshStartConfirm && phase === "PLAYING" ? (
        <View style={styles.overlay}>
          <Text style={styles.confirmHeadline}>END SAVED RUN?</Text>
          <Text style={styles.gameOverBody}>
            This will wipe your saved board and start fresh.
          </Text>
          <Pressable
            testID="sugarcoat-fresh-confirm"
            onPress={reset}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.primaryBtnLabel}>START FRESH</Text>
          </Pressable>
          <Pressable
            testID="sugarcoat-fresh-cancel"
            onPress={() => setShowFreshStartConfirm(false)}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.secondaryBtnLabel}>KEEP SAVED RUN</Text>
          </Pressable>
        </View>
      ) : null}

      {showRestartConfirm && phase === "PLAYING" ? (
        <View style={styles.overlay}>
          <Text style={styles.confirmHeadline}>RESTART RUN?</Text>
          <Text style={styles.gameOverBody}>
            Board, CLOUT, and moves reset.
          </Text>
          <Pressable
            testID="sugarcoat-restart-confirm"
            onPress={reset}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.primaryBtnLabel}>RESTART</Text>
          </Pressable>
          <Pressable
            testID="sugarcoat-restart-cancel"
            onPress={() => setShowRestartConfirm(false)}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.secondaryBtnLabel}>KEEP PLAYING</Text>
          </Pressable>
        </View>
      ) : null}

      {phase === "GAME_OVER" ? (
        <View style={styles.overlay}>
          <Text style={styles.gameOverHeadline}>OUT OF CLOUT</Text>
          <Text style={styles.gameOverBody}>
            Final: {score} · Best: {Math.max(bestClout, score)}
          </Text>
          <Pressable
            testID="sugarcoat-replay"
            onPress={reset}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.primaryBtnLabel}>REPLAY</Text>
          </Pressable>
          <Pressable
            testID="sugarcoat-home"
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#09090b",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 18,
    paddingHorizontal: 22,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: "#18181b",
  },
  title: {
    color: "#ec4899",
    fontSize: 18,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  restartBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#27272a",
    backgroundColor: "#18181b",
    alignItems: "center",
    justifyContent: "center",
  },
  freshBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ec4899",
    backgroundColor: "#18181b",
    alignItems: "center",
    justifyContent: "center",
  },
  freshBtnLabel: {
    color: "#ec4899",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  confirmHeadline: {
    color: "white",
    fontSize: 28,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: 1,
    marginBottom: 14,
    textAlign: "center",
    textTransform: "uppercase",
  },
  statBlock: {
    alignItems: "flex-end",
  },
  statLabel: {
    color: "#52525b",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  statValue: {
    color: "white",
    fontSize: 16,
    fontWeight: "900",
    fontStyle: "italic",
    marginTop: 2,
  },
  boardWrap: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
  },
  board: {
    flexDirection: "row",
    flexWrap: "wrap",
    aspectRatio: 1,
  },
  cell: {
    width: `${100 / SIZE}%`,
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#0f0f11",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: "#18181b",
  },
  footerLabel: {
    color: "#52525b",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  footerValue: {
    color: "white",
    fontSize: 14,
    fontWeight: "900",
    fontStyle: "italic",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  gameOverHeadline: {
    color: "#dc2626",
    fontSize: 44,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: 1,
    marginBottom: 16,
    textAlign: "center",
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
