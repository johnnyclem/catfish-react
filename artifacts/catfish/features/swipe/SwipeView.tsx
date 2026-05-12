/**
 * SwipeView — top-level Swipe tab.
 *
 * Translated from the SwiftUI SwipeView in the source doc:
 *   - Renders the top 3 candidates from `run.deck` starting at `deckCursor`
 *   - Drag-to-commit (handled in SwipeCard)
 *   - Tap buttons also commit (delegates to SwipeCard.commit())
 *   - Right swipe shows a brief LIKE! stamp; matches resolve overnight
 *     in `advanceDay()` and surface as `MatchCelebration` overlays
 *     drained from `run.pendingMatchAnnouncements`.
 *   - Empty state shows "deck is dry" with a Sleep button that ticks
 *     the day clock (which also resolves any outstanding likes).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { SwipeCard, SwipeCardHandle } from "./SwipeCard";

import { LikeStamp } from "@/components/LikeStamp";
import { MatchCelebration } from "@/components/MatchCelebration";
import { NeonButton, PixelPanel, PixelText, ScanlineOverlay } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";
import { Candidate } from "@/core/models";
import { emitSfx } from "@/features/audio/audioEvents";

interface LikeStampState {
  visible: boolean;
  name: string;
  /**
   * Bumped on every right-swipe so back-to-back likes restart the
   * stamp animation instead of reusing the still-animating one. The
   * value is part of the React `key` on the LikeStamp.
   */
  nonce: number;
}

interface DayBannerState {
  visible: boolean;
  day: number;
}

const DAY_BANNER_MS = 1200;

export function SwipeView() {
  const run = useGameState((s) => s.run);
  const swipe = useGameState((s) => s.swipe);
  const advanceDay = useGameState((s) => s.advanceDay);
  const acknowledgeMatchAnnouncement = useGameState(
    (s) => s.acknowledgeMatchAnnouncement,
  );
  const hydrated = useGameState((s) => s.hydrated);
  const topCardRef = useRef<SwipeCardHandle>(null);
  const [likeStamp, setLikeStamp] = useState<LikeStampState>({
    visible: false,
    name: "",
    nonce: 0,
  });
  const [dayBanner, setDayBanner] = useState<DayBannerState>({
    visible: false,
    day: 0,
  });
  // Track the last (run, day) we observed so we can fire the "Day N
  // begins" banner exactly once per tick — but only when there are no
  // match announcements competing for the same patch of screen. We
  // key off run.id too so that ending one case and starting a fresh
  // one (day 7 → day 1) is recognized as a new run rather than as a
  // backwards day-change that would falsely trigger the day_end SFX.
  const prevDayRef = useRef<{ runId: string; day: number } | null>(null);

  const remaining: Candidate[] = useMemo(() => {
    if (!run) return [];
    return run.deck.slice(run.deckCursor);
  }, [run]);

  const announcements = run?.pendingMatchAnnouncements ?? [];
  const pendingLikes = run?.pendingLikes ?? [];
  const stillThinking = pendingLikes.filter(
    (l) => l.status === "pending",
  ).length;

  // Top of the announcement queue — derive name from the matched
  // candidate so a cold start mid-queue still surfaces the right
  // overlay instead of an anonymous heart.
  const activeAnnouncement = useMemo(() => {
    if (!run || announcements.length === 0) return null;
    const matchId = announcements[0]!;
    const match = run.matches.find((m) => m.id === matchId);
    if (!match) return { matchId, name: "?" };
    const candidate = run.deck.find((c) => c.id === match.candidateId);
    return {
      matchId,
      name: candidate?.displayName ?? "?",
    };
  }, [run, announcements]);

  // "Day N begins" banner — show on day change when no celebrations
  // are queued. Initialize the previous-day pointer on first render
  // so a fresh hydrate doesn't immediately fire a phantom banner.
  useEffect(() => {
    if (!run) return;
    const prev = prevDayRef.current;
    // First observation, or a brand-new run (different id) — initialize
    // the pointer without firing day_end. Otherwise a fresh case would
    // open with a phantom "end of day" sting on day 1.
    if (prev === null || prev.runId !== run.id) {
      prevDayRef.current = { runId: run.id, day: run.day };
      return;
    }
    if (run.day === prev.day) return;
    prevDayRef.current = { runId: run.id, day: run.day };
    // Day-end SFX always fires on the tick — even when the End-of-
    // Run card is about to take over (it gives the close a beat of
    // its own). The win/lose sting then plays on top a moment later.
    emitSfx("day_end");
    emitSfx("day_advance");
    if (announcements.length > 0) return;
    // Don't congratulate the player on reaching Day 7 — the End-of-
    // Run card is about to take over and own the screen.
    if (run.closed) return;
    setDayBanner({ visible: true, day: run.day });
    const t = setTimeout(() => {
      setDayBanner({ visible: false, day: run.day });
    }, DAY_BANNER_MS);
    return () => clearTimeout(t);
  }, [run, announcements.length]);

  const handleCommit = useCallback(
    async (direction: "left" | "right") => {
      if (!run) return;
      const top = remaining[0];
      if (!top) return;
      const accepted = await swipe(top.id, direction);
      // Only fire SFX once the store accepted the swipe. A rejected
      // commit (stale tap, integrity guard, etc.) shouldn't make a
      // sound — the deck didn't actually move.
      if (!accepted) return;
      emitSfx(direction === "right" ? "swipe_like" : "swipe_pass");
      if (direction === "right") {
        setLikeStamp((prev) => ({
          visible: true,
          name: top.displayName,
          nonce: prev.nonce + 1,
        }));
      }
    },
    [remaining, run, swipe],
  );

  const handleButton = useCallback((direction: "left" | "right") => {
    topCardRef.current?.commit(direction);
  }, []);

  const hideLikeStamp = useCallback(() => {
    setLikeStamp((prev) => ({ ...prev, visible: false }));
  }, []);

  const dismissCelebration = useCallback(() => {
    if (!activeAnnouncement) return;
    void acknowledgeMatchAnnouncement(activeAnnouncement.matchId);
  }, [activeAnnouncement, acknowledgeMatchAnnouncement]);

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
            {stillThinking > 0 && (
              <PixelText
                size={7}
                color={cfPalette.pinkHot}
                align="center"
                style={{ marginTop: 12 }}
              >
                {`${stillThinking} ${stillThinking === 1 ? "person is" : "people are"} still thinking about it.`}
              </PixelText>
            )}
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
            label="♥ Like"
            variant="primary"
            onPress={() => handleButton("right")}
          />
        </View>
      )}

      <LikeStamp
        // Keying on the nonce remounts the stamp on every right-swipe
        // so a rapid-fire second like doesn't get swallowed by the
        // first stamp's still-running fade-out timer.
        key={`like-${likeStamp.nonce}`}
        visible={likeStamp.visible}
        candidateName={likeStamp.name}
        onHide={hideLikeStamp}
      />

      {activeAnnouncement && (
        <MatchCelebration
          // Keying on matchId forces a remount per announcement so
          // chained celebrations restart the heart-pop animation
          // instead of reusing the previous one's animated values.
          key={`match-${activeAnnouncement.matchId}`}
          visible
          candidateName={activeAnnouncement.name}
          onDismiss={dismissCelebration}
        />
      )}

      {dayBanner.visible && !activeAnnouncement && (
        <View pointerEvents="none" style={styles.dayBannerLayer}>
          <PixelPanel variant="raised" style={styles.dayBanner}>
            <PixelText size={12} color={cfPalette.cyan} uppercase glow align="center">
              {`day ${dayBanner.day} begins`}
            </PixelText>
          </PixelPanel>
        </View>
      )}
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
  dayBannerLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
  },
  dayBanner: {
    paddingVertical: 16,
    paddingHorizontal: 28,
  },
});
