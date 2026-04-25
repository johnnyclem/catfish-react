/**
 * Thread screen — Pass 3 stop-gap chat surface.
 *
 * Pass 2 owns the real chat / message system. Until that lands, Pass 3
 * still needs an in-product surface where the player can long-press a
 * candidate's message to file it as a Fact. This screen provides that:
 * it synthesizes a small set of chat bubbles from the identity module's
 * existing prompts so the Journal capture gesture is reachable today.
 *
 * Pass 2 should:
 *   - replace `synthesizeSeedMessages` with reads from the persisted
 *     ChatThread.messages array
 *   - keep MessageFactGesture wrapping each candidate bubble
 *   - extend with reply composer, mood-driven portraits, etc.
 *
 * Synthesized messages use stable ids so long-press dedupe and the
 * "filed" badge survive screen revisits.
 */

import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AssetImage } from "@/components/AssetImage";
import {
  PixelPanel,
  PixelText,
  ScanlineOverlay,
} from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";
import {
  Candidate,
  ChatMessage,
  ChatThread,
  MatchRelationship,
  ThreadId,
} from "@/core/models";
import { MessageFactGesture } from "@/features/journal/MessageFactGesture";

interface SeedSource {
  thread: ChatThread;
  match: MatchRelationship;
  candidate: Candidate;
}

function synthesizeSeedMessages(src: SeedSource, currentDay: number): ChatMessage[] {
  const { thread, candidate, match } = src;
  const day = match.matchedOnDay;

  // Lift conversational lines out of the candidate's authored prompts.
  // Prompts read as first-person ("Coffee order: …"), which is close
  // enough to chat voice for Pass 3's stop-gap. Pass 2 replaces this.
  const promptLines = candidate.prompts.slice(0, 3);

  const seeds: Omit<ChatMessage, "id">[] = [
    {
      threadId: thread.id,
      candidateId: candidate.id,
      role: "candidate",
      body: `hey — so this is a little wild. you actually swiped back.`,
      sentAt: match.matchedAt,
      day,
    },
    {
      threadId: thread.id,
      candidateId: candidate.id,
      role: "candidate",
      body: `quick intro: ${candidate.tagline}`,
      sentAt: match.matchedAt,
      day,
    },
    ...promptLines.map((line) => ({
      threadId: thread.id,
      candidateId: candidate.id,
      role: "candidate" as const,
      body: line,
      sentAt: match.matchedAt,
      day,
    })),
  ];

  // If the run has advanced past the matched day, drop a follow-up so
  // there's something to capture from a later day too. Pass 2 will
  // replace this with proper day-driven beats.
  if (currentDay > day) {
    seeds.push({
      threadId: thread.id,
      candidateId: candidate.id,
      role: "candidate",
      body: `thinking about you. anything good happen today?`,
      sentAt: new Date().toISOString(),
      day: currentDay,
    });
  }

  return seeds.map((s, idx) => ({
    ...s,
    id: `${thread.id}_seed_${idx}`,
  }));
}

export default function ThreadScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const threadId = params.id as ThreadId | undefined;

  const run = useGameState((s) => s.run);
  const topPad = Math.max(insets.top, Platform.OS === "web" ? 24 : 12);

  const source = useMemo<SeedSource | null>(() => {
    if (!run || !threadId) return null;
    const thread = run.threads.find((t) => t.id === threadId);
    if (!thread) return null;
    const match = run.matches.find((m) => m.threadId === threadId);
    if (!match) return null;
    const candidate = run.deck.find((c) => c.id === thread.candidateId);
    if (!candidate) return null;
    return { thread, match, candidate };
  }, [run, threadId]);

  const messages = useMemo<ChatMessage[]>(
    () => (source && run ? synthesizeSeedMessages(source, run.day) : []),
    [source, run],
  );

  if (!source) {
    return (
      <View style={[styles.root, { paddingTop: topPad }]}>
        <ScanlineOverlay />
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <PixelText size={8} color={cfPalette.cyan} uppercase>
            ← back
          </PixelText>
        </Pressable>
        <View style={styles.center}>
          <PixelText size={9} color={cfPalette.ash} align="center">
            Thread not found.
          </PixelText>
        </View>
      </View>
    );
  }

  const { candidate } = source;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <ScanlineOverlay />

      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <PixelText size={8} color={cfPalette.cyan} uppercase>
            ← back
          </PixelText>
        </Pressable>
        <View style={styles.avatarWrap}>
          <AssetImage
            id={candidate.portraitAssetId ?? "A500_avatar_placeholder"}
            style={styles.avatar}
            containerStyle={styles.avatar}
            resizeMode="cover"
          />
        </View>
        <View style={{ flex: 1, paddingLeft: 10 }}>
          <PixelText size={11} color={cfPalette.bone} uppercase>
            {candidate.displayName}
          </PixelText>
          <PixelText size={6} color={cfPalette.ash} style={{ marginTop: 4 }}>
            {`matched day ${source.match.matchedOnDay}`}
          </PixelText>
        </View>
      </View>

      <PixelPanel variant="ghost" style={styles.tip} borderColor={cfPalette.purple}>
        <PixelText size={6} color={cfPalette.purpleHot} uppercase>
          tip
        </PixelText>
        <PixelText
          size={6}
          color={cfPalette.ash}
          style={{ marginTop: 4, lineHeight: 10 }}
        >
          Tap and hold any message to file it in the Journal as a Fact.
        </PixelText>
      </PixelPanel>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}

        <PixelText
          size={6}
          color={cfPalette.fog}
          align="center"
          style={styles.footer}
        >
          Reply composer arrives in Pass 2.
        </PixelText>
      </ScrollView>
    </View>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <MessageFactGesture
      candidateId={message.candidateId}
      threadId={message.threadId}
      messageId={message.id}
      quote={message.body}
      // Capture is gated to candidate-authored lines so the player
      // can't accidentally file their own typing as a Fact.
      disabled={message.role !== "candidate"}
    >
      <PixelPanel variant="default" style={styles.bubble}>
        <PixelText size={9} color={cfPalette.bone} style={styles.bubbleBody}>
          {message.body}
        </PixelText>
        <PixelText size={6} color={cfPalette.ash} uppercase style={styles.bubbleMeta}>
          {`day ${message.day}`}
        </PixelText>
      </PixelPanel>
    </MessageFactGesture>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: cfPalette.navyDeep,
    paddingHorizontal: 18,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 12,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginRight: 8,
  },
  avatarWrap: {
    width: 40,
    height: 40,
  },
  avatar: {
    width: 40,
    height: 40,
  },
  tip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  list: {
    paddingBottom: Platform.OS === "web" ? 100 : 24,
    gap: 10,
  },
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
    maxWidth: "92%",
  },
  bubbleBody: {
    lineHeight: 14,
  },
  bubbleMeta: {
    marginTop: 6,
  },
  footer: {
    marginTop: 18,
  },
});
