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
import { getScriptForCandidate } from "@/core/identities";
import { ThreadId } from "@/core/models";

interface ThreadViewProps {
  threadId: ThreadId;
}

export function ThreadView({ threadId }: ThreadViewProps) {
  const insets = useSafeAreaInsets();
  const run = useGameState((s) => s.run);
  const hydrated = useGameState((s) => s.hydrated);
  const openThread = useGameState((s) => s.openThread);
  const sendReply = useGameState((s) => s.sendReply);

  const [pending, setPending] = useState(false);
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

  const replyOptions = useMemo(() => {
    if (!candidate || !thread) return [];
    const script = getScriptForCandidate(candidate);
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

  const script = getScriptForCandidate(candidate);
  const isOutOfScript =
    thread.turnIndex >= script.length && thread.messages.length > 0;

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
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {thread.messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {isOutOfScript && (
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
      </ScrollView>

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
  footer: {
    borderTopWidth: 2,
    borderTopColor: cfPalette.purple,
    backgroundColor: cfPalette.navy,
  },
});
