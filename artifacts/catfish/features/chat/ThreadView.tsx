/**
 * ThreadView — top-level chat screen for a single match.
 *
 * Mounting flow:
 *   - On mount, calls `openThread()` (idempotent) so the suspect's opening
 *     salvo is delivered the first time the player taps in.
 *   - Auto-scrolls to the newest message after every store update.
 *   - When the script runs out of authored turns, the picker collapses and
 *     a quiet "you're caught up" hint appears in its place.
 *
 * Pass 4 will replace the static script lookup with fact-aware planning,
 * but the contract here (push messages → render bubbles → pick reply)
 * stays identical so the UI doesn't churn.
 */

import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MessageBubble } from "./MessageBubble";
import { ReplyPicker } from "./ReplyPicker";

import { AssetImage } from "@/components/AssetImage";
import {
  PixelPanel,
  PixelText,
  ScanlineOverlay,
} from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";
import { getScriptForThread } from "@/core/identities";
import { ThreadId } from "@/core/models";
import { MessageFactGesture } from "@/features/journal/MessageFactGesture";
import { useDialogueVoice } from "@/features/voice/useDialogueVoice";
import type { Message } from "@/core/models";

/**
 * Compute the per-beat line index for a suspect message — i.e. "this
 * is the Nth suspect line in this beat". Mirrors the pre-gen script's
 * filename pattern so a cached clip resolves on first try.
 *
 * Counts only suspect-sender messages with the same beatKey, and only
 * those that appear at-or-before `messageId` in the transcript.
 */
function computeLineIndex(
  messages: Message[],
  messageId: string,
  beatKey: string,
): number {
  let n = 0;
  for (const m of messages) {
    if (m.sender !== "suspect") continue;
    if ((m.beatKey ?? "unknown") !== beatKey) continue;
    if (m.id === messageId) return n;
    n += 1;
  }
  // Shouldn't happen — if it does we still return 0 so the lookup
  // can at least try the first clip in this beat.
  return 0;
}

interface UnmatchControlProps {
  isUnmatched: boolean;
  pending: boolean;
  onConfirm: () => void;
}

/**
 * Two-tap confirm for the unmatch gesture. Lives in the chat header so
 * the player has to be looking at the suspect they're about to drop.
 *
 * State machine: idle → confirming → (confirm | cancel) → idle.
 * The confirming view exposes both a CANCEL and a CONFIRM hit so the
 * player can back out without leaving the screen.
 */
function UnmatchControl({ isUnmatched, pending, onConfirm }: UnmatchControlProps) {
  const [confirming, setConfirming] = useState(false);

  if (isUnmatched) {
    return (
      <View style={styles.unmatchedTag} testID="thread-unmatched-tag">
        <PixelText size={6} color={cfPalette.fog} uppercase>
          dropped
        </PixelText>
      </View>
    );
  }

  if (!confirming) {
    return (
      <Pressable
        onPress={() => setConfirming(true)}
        disabled={pending}
        hitSlop={8}
        style={({ pressed }) => [
          styles.unmatchBtn,
          { opacity: pressed ? 0.6 : pending ? 0.4 : 1 },
        ]}
        testID="thread-unmatch"
      >
        <PixelText size={7} color={cfPalette.err} uppercase>
          drop
        </PixelText>
      </Pressable>
    );
  }

  return (
    <View style={styles.confirmRow}>
      <Pressable
        onPress={() => setConfirming(false)}
        disabled={pending}
        hitSlop={6}
        style={({ pressed }) => [
          styles.confirmCancelBtn,
          { opacity: pressed ? 0.6 : 1 },
        ]}
        testID="thread-unmatch-cancel"
      >
        <PixelText size={7} color={cfPalette.ash} uppercase>
          keep
        </PixelText>
      </Pressable>
      <Pressable
        onPress={onConfirm}
        disabled={pending}
        hitSlop={6}
        style={({ pressed }) => [
          styles.confirmDangerBtn,
          { opacity: pressed ? 0.6 : pending ? 0.5 : 1 },
        ]}
        testID="thread-unmatch-confirm"
      >
        <PixelText size={7} color={cfPalette.bone} uppercase>
          confirm drop
        </PixelText>
      </Pressable>
    </View>
  );
}

interface ThreadViewProps {
  threadId: ThreadId;
}

export function ThreadView({ threadId }: ThreadViewProps) {
  const insets = useSafeAreaInsets();
  const run = useGameState((s) => s.run);
  const hydrated = useGameState((s) => s.hydrated);
  const openThread = useGameState((s) => s.openThread);
  const sendReply = useGameState((s) => s.sendReply);
  const unmatchThread = useGameState((s) => s.unmatchThread);
  const markThreadRead = useGameState((s) => s.markThreadRead);
  const requestImprovTurn = useGameState((s) => s.requestImprovTurn);

  const [pending, setPending] = useState(false);
  const [unmatchPending, setUnmatchPending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const thread = useMemo(
    () => run?.threads.find((t) => t.id === threadId) ?? null,
    [run, threadId],
  );
  const candidate = useMemo(
    () =>
      thread
        ? run?.deck.find((c) => c.id === thread.candidateId) ?? null
        : null,
    [run, thread],
  );
  const match = useMemo(
    () => run?.matches.find((m) => m.threadId === threadId) ?? null,
    [run, threadId],
  );
  const isUnmatched = match?.unmatched ?? false;

  // Lazy push the opening turn the first time the player lands here.
  // openThread() is itself idempotent so re-mounts (back nav) are safe.
  useEffect(() => {
    if (!hydrated || !thread) return;
    if (thread.messages.length === 0 && thread.turnIndex === 0) {
      void openThread(threadId);
    }
  }, [hydrated, thread, threadId, openThread]);

  // Auto-scroll to bottom whenever messages change.
  useEffect(() => {
    const t = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 60);
    return () => clearTimeout(t);
  }, [thread?.messages.length]);

  // Voice playback — auto-plays *new* suspect bubbles only. Tracking
  // played message ids in a ref (instead of by length delta) keeps the
  // mute/un-mute round-trip honest: messages added while muted aren't
  // suddenly auto-played the moment the user un-mutes.
  const voice = useDialogueVoice();
  const playedIdsRef = useRef<Set<string>>(new Set());
  const seededRef = useRef(false);
  const candidateRef = useRef<typeof candidate>(candidate);
  candidateRef.current = candidate;

  useEffect(() => {
    if (!hydrated || !thread || !candidate) return;
    // First time we see this thread post-mount, mark every existing
    // suspect message as already played — re-mounts (back nav) and
    // cold starts must NOT replay the whole transcript.
    if (!seededRef.current) {
      for (const m of thread.messages) {
        if (m.sender === "suspect") playedIdsRef.current.add(m.id);
      }
      seededRef.current = true;
      return;
    }
    // Auto-play any suspect bubbles we haven't seen yet, in order.
    for (const m of thread.messages) {
      if (m.sender !== "suspect") continue;
      if (playedIdsRef.current.has(m.id)) continue;
      playedIdsRef.current.add(m.id);
      // Lines without a beatKey can't resolve a pre-baked clip — the
      // hook will silently fall back to live TTS.
      const beatKey = m.beatKey ?? "unknown";
      // Sequence index inside the same beat: nth suspect message in a
      // row sharing the same beatKey. Mirrors the pre-gen filename
      // pattern so cached clips line up.
      const lineIndex = computeLineIndex(thread.messages, m.id, beatKey);
      void voice.playLine(candidateRef.current!, beatKey, lineIndex, m.text);
    }
  }, [hydrated, thread, candidate, voice]);

  // Clear unread once on initial focus of this thread. We deliberately
  // do NOT re-fire on every thread mutation — when sendReply pushes a
  // new suspect turn, that bump should persist on the Matches row so
  // the player sees a badge after they navigate back. markThreadRead
  // fires again on the next focus (re-mount) when they re-enter.
  useEffect(() => {
    if (!hydrated) return;
    void markThreadRead(threadId);
  }, [hydrated, threadId, markThreadRead]);

  // Auto-recover an out-of-script innocent thread that landed without
  // staged improv options (e.g. cold start during an in-flight call,
  // or a previous failure that the player navigated away from before
  // tapping retry). The store-level single-flight guard makes this
  // safe to fire alongside the explicit retry button.
  useEffect(() => {
    if (!hydrated || !thread || !candidate) return;
    if (candidate.isKillerCandidate) return;
    const script = getScriptForThread(thread, candidate);
    const outOfScript = thread.turnIndex >= script.length;
    const hasOptions = (thread.improvReplyOptions?.length ?? 0) > 0;
    if (
      outOfScript &&
      !hasOptions &&
      !thread.improvPending &&
      !thread.improvError
    ) {
      void requestImprovTurn(threadId);
    }
  }, [hydrated, thread, candidate, threadId, requestImprovTurn]);

  const replyOptions = useMemo(() => {
    if (!candidate || !thread) return [];
    const script = getScriptForThread(thread, candidate);
    // Once the scripted tree is exhausted, the picker is sourced from
    // the live improv reply options that arrived with the most recent
    // Gemini-generated suspect turn (Task #58). Killer threads stay on
    // the script and never branch into improv.
    if (
      !candidate.isKillerCandidate &&
      thread.turnIndex >= script.length
    ) {
      return thread.improvReplyOptions ?? [];
    }
    // The picker shows the replies that *belong* to the most recent
    // suspect turn — i.e. script[turnIndex - 1].
    const turn = script[thread.turnIndex - 1];
    return turn ? turn.replyOptions : [];
  }, [candidate, thread]);

  const handlePick = useCallback(
    async (option: string) => {
      if (!thread || pending) return;
      setPending(true);
      try {
        await sendReply(thread.id, option);
      } finally {
        setPending(false);
      }
    },
    [thread, pending, sendReply],
  );

  const handleUnmatch = useCallback(async () => {
    if (!match || match.unmatched || unmatchPending) return;
    setUnmatchPending(true);
    try {
      await unmatchThread(match.id);
      // Pop back to the matches tab so the player sees their refreshed
      // (de-emphasized) row immediately. The thread route still
      // resolves — but with the picker hidden — if they navigate back.
      router.back();
    } finally {
      setUnmatchPending(false);
    }
  }, [match, unmatchPending, unmatchThread]);

  const topPad = Math.max(insets.top, Platform.OS === "web" ? 24 : 12);

  if (!hydrated) {
    return (
      <View style={[styles.center, { backgroundColor: cfPalette.navyDeep }]}>
        <PixelText size={10} color={cfPalette.ash}>
          loading thread…
        </PixelText>
      </View>
    );
  }

  if (!thread || !candidate) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: cfPalette.navyDeep, paddingTop: topPad },
        ]}
      >
        <PixelText size={10} color={cfPalette.err} align="center" uppercase>
          thread missing
        </PixelText>
        <PixelText
          size={7}
          color={cfPalette.ash}
          align="center"
          style={{ marginTop: 12 }}
        >
          This match was unmatched or the run was reset.
        </PixelText>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backLink,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          testID="thread-back-missing"
        >
          <PixelText size={9} color={cfPalette.cyan} uppercase>
            ◂ back
          </PixelText>
        </Pressable>
      </View>
    );
  }

  const script = getScriptForThread(thread, candidate);
  // Killer threads still hit the "you're caught up" hint at the end of
  // their bespoke script. Innocent threads fall back to live improv
  // (Task #58) so they never run out — instead they show a typing
  // indicator while a turn is in flight, or a retry hint on failure.
  const isOutOfScript =
    candidate.isKillerCandidate &&
    thread.turnIndex >= script.length &&
    thread.messages.length > 0;
  const showImprovTyping =
    !candidate.isKillerCandidate &&
    !!thread.improvPending &&
    thread.messages.length > 0;
  const showImprovError =
    !candidate.isKillerCandidate &&
    !!thread.improvError &&
    !thread.improvPending;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <ScanlineOverlay />

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backHit,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          testID="thread-back"
          hitSlop={12}
        >
          <PixelText size={10} color={cfPalette.cyan} uppercase>
            ◂
          </PixelText>
        </Pressable>
        <View style={styles.headerAvatar}>
          <AssetImage
            id={candidate.portraitAssetId ?? "A500_avatar_placeholder"}
            style={styles.headerAvatarImg}
            containerStyle={styles.headerAvatarImg}
            resizeMode="cover"
          />
        </View>
        <View style={{ flex: 1, paddingLeft: 10 }}>
          <PixelText size={11} color={cfPalette.bone} uppercase>
            {candidate.displayName}
          </PixelText>
          <PixelText
            size={6}
            color={cfPalette.ash}
            style={{ marginTop: 4, lineHeight: 10 }}
          >
            {candidate.tagline}
          </PixelText>
        </View>
        {match && (
          <UnmatchControl
            isUnmatched={isUnmatched}
            pending={unmatchPending}
            onConfirm={handleUnmatch}
          />
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {thread.messages.map((m) => (
          // Tap-and-hold a suspect bubble to file it as a Fact.
          // Player bubbles pass `disabled` so we don't accidentally
          // capture the detective's own replies as evidence.
          // `MessageFactGesture` no-ops when disabled.
          <MessageFactGesture
            key={m.id}
            candidateId={candidate.id}
            threadId={thread.id}
            messageId={m.id}
            quote={m.text}
            disabled={m.sender === "player"}
          >
            <MessageBubble message={m} />
          </MessageFactGesture>
        ))}
        {isUnmatched && (
          <PixelPanel variant="ghost" style={styles.endHint}>
            <PixelText
              size={7}
              color={cfPalette.fog}
              align="center"
              uppercase
              style={{ letterSpacing: 1 }}
            >
              thread dropped
            </PixelText>
            <PixelText
              size={6}
              color={cfPalette.fog}
              align="center"
              style={{ marginTop: 6, lineHeight: 10 }}
            >
              archived for your case file. they can't reply.
            </PixelText>
          </PixelPanel>
        )}
        {!isUnmatched && isOutOfScript && (
          <PixelPanel variant="ghost" style={styles.endHint}>
            <PixelText
              size={7}
              color={cfPalette.fog}
              align="center"
              uppercase
              style={{ letterSpacing: 1 }}
            >
              you're caught up
            </PixelText>
            <PixelText
              size={6}
              color={cfPalette.fog}
              align="center"
              style={{ marginTop: 6, lineHeight: 10 }}
            >
              new beats land in later passes.
            </PixelText>
          </PixelPanel>
        )}
        {!isUnmatched && showImprovTyping && (
          <View testID="thread-improv-typing">
            <PixelPanel variant="ghost" style={styles.endHint}>
              <PixelText
                size={7}
                color={cfPalette.fog}
                align="center"
                uppercase
                style={{ letterSpacing: 1 }}
              >
                {candidate.displayName.toLowerCase()} is typing…
              </PixelText>
            </PixelPanel>
          </View>
        )}
        {!isUnmatched && showImprovError && (
          <View testID="thread-improv-error">
            <PixelPanel variant="ghost" style={styles.endHint}>
            <PixelText
              size={7}
              color={cfPalette.err}
              align="center"
              uppercase
              style={{ letterSpacing: 1 }}
            >
              connection lost
            </PixelText>
            <PixelText
              size={6}
              color={cfPalette.fog}
              align="center"
              style={{ marginTop: 6, lineHeight: 10 }}
            >
              {candidate.displayName.toLowerCase()} dropped off mid-text.
            </PixelText>
            <Pressable
              onPress={() => void requestImprovTurn(thread.id)}
              style={({ pressed }) => [
                styles.retryBtn,
                { opacity: pressed ? 0.6 : 1 },
              ]}
              testID="thread-improv-retry"
            >
              <PixelText size={7} color={cfPalette.cyan} uppercase>
                tap to retry
              </PixelText>
            </Pressable>
            </PixelPanel>
          </View>
        )}
      </ScrollView>

      {!isUnmatched && (
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <ReplyPicker
            options={replyOptions}
            pending={pending}
            onPick={handlePick}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: cfPalette.navyDeep,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  backLink: {
    marginTop: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: cfPalette.cyan,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: cfPalette.purple,
  },
  backHit: {
    paddingRight: 12,
    paddingVertical: 6,
  },
  headerAvatar: {
    width: 40,
    height: 40,
  },
  headerAvatarImg: {
    width: 40,
    height: 40,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 18,
  },
  endHint: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  retryBtn: {
    marginTop: 10,
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: cfPalette.cyan,
  },
  footer: {
    borderTopWidth: 2,
    borderTopColor: cfPalette.purple,
    backgroundColor: cfPalette.navy,
  },
  unmatchBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: cfPalette.err,
  },
  unmatchedTag: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: cfPalette.fog,
  },
  confirmRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  confirmCancelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: cfPalette.ash,
  },
  confirmDangerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: cfPalette.err,
    backgroundColor: cfPalette.err,
  },
});
