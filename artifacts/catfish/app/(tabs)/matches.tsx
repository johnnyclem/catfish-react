/**
 * Tab 2 — Matches.
 *
 * Pass 2: each match is a tappable row that pushes into the per-thread
 * chat. The row also previews the most recent message and surfaces a
 * dim "new" pip for threads the player hasn't opened yet, so the tab
 * feels alive even before the player taps in.
 */

import { Link } from "expo-router";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AssetImage } from "@/components/AssetImage";
import {
  PixelPanel,
  PixelText,
  ScanlineOverlay,
} from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";

export default function MatchesTab() {
  const insets = useSafeAreaInsets();
  const run = useGameState((s) => s.run);
  const topPad = Math.max(insets.top, Platform.OS === "web" ? 24 : 12);

  const matches = run?.matches ?? [];
  // Live leads first, dropped rows pinned to the bottom. We sort instead
  // of filtering them out so the player can re-open dropped threads to
  // re-read evidence — Pass 3's Journal still cites them.
  const orderedMatches = [...matches].sort((a, b) => {
    if (a.unmatched === b.unmatched) return 0;
    return a.unmatched ? 1 : -1;
  });
  // Task #31 — count likes that didn't reciprocate so the run record
  // doesn't silently drop them. Cumulative across the run; resets only
  // when the player starts a new case. Today this stays at 0 because
  // every authored deck candidate is a "story" candidate; once the
  // wider city-pool task lands and pure decoys can pass on a like,
  // this surfaces the "3 didn't reply" cue called out in Task #31.
  const passedLikeCount = (run?.pendingLikes ?? []).filter(
    (l) => l.status === "passed",
  ).length;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <ScanlineOverlay />
      <PixelText size={14} color={cfPalette.cyan} uppercase glow style={styles.title}>
        matches
      </PixelText>
      <PixelText size={7} color={cfPalette.ash} style={styles.subtitle}>
        Tap a match to open the thread.
      </PixelText>
      {passedLikeCount > 0 ? (
        <View testID="matches-passed-note" style={styles.passedNote}>
          <PixelText size={7} color={cfPalette.fog}>
            {`${passedLikeCount} didn't reply.`}
          </PixelText>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.list}>
        {orderedMatches.length === 0 ? (
          <PixelPanel variant="raised" style={styles.empty}>
            <PixelText size={9} color={cfPalette.ash} align="center" style={{ lineHeight: 14 }}>
              No matches yet.{"\n"}Swipe right on someone to start a thread.
            </PixelText>
          </PixelPanel>
        ) : (
          orderedMatches.map((m) => {
            const cand = run!.deck.find((c) => c.id === m.candidateId);
            const thread = run!.threads.find((t) => t.id === m.threadId);
            const lastMsg = thread?.messages[thread.messages.length - 1];
            const previewRaw =
              lastMsg?.text ??
              "they matched you. open the thread to say hi.";
            // Truncate to keep the row to a single, predictable height —
            // the chat screen shows the full message.
            const preview =
              previewRaw.length > 64
                ? `${previewRaw.slice(0, 61).trimEnd()}…`
                : previewRaw;
            const isDropped = m.unmatched;
            const unread = isDropped ? 0 : (thread?.unreadCount ?? 0);
            const isUnopened =
              !isDropped && unread === 0 && (!thread || thread.messages.length === 0);

            // Cap the visible count so the pip stays a single, predictable
            // width even after a long stretch of unanswered turns.
            const unreadLabel = unread > 9 ? "9+" : String(unread);
            return (
              <Link
                key={m.id}
                href={`/chat/${m.threadId}` as never}
                asChild
              >
                <Pressable
                  testID={`match-row-${m.id}`}
                  style={({ pressed }) => [
                    styles.rowPress,
                    {
                      opacity: pressed
                        ? 0.7
                        : isDropped
                          ? 0.55
                          : 1,
                    },
                  ]}
                >
                  <PixelPanel
                    variant="default"
                    style={[styles.row, isDropped && styles.rowDropped]}
                  >
                    <View style={styles.avatarWrap}>
                      <AssetImage
                        id={cand?.portraitAssetId ?? "A500_avatar_placeholder"}
                        style={styles.avatar}
                        containerStyle={styles.avatar}
                        resizeMode="cover"
                      />
                    </View>
                    <View style={styles.body}>
                      <View style={styles.bodyHeader}>
                        <PixelText
                          size={10}
                          color={isDropped ? cfPalette.fog : cfPalette.bone}
                          uppercase
                        >
                          {cand?.displayName ?? "unknown"}
                        </PixelText>
                        {isDropped ? (
                          <View
                            style={styles.droppedPip}
                            testID={`match-dropped-${m.id}`}
                          >
                            <PixelText
                              size={6}
                              color={cfPalette.fog}
                              uppercase
                            >
                              dropped
                            </PixelText>
                          </View>
                        ) : unread > 0 ? (
                          <View
                            style={styles.unreadPip}
                            testID={`match-unread-${m.id}`}
                          >
                            <PixelText
                              size={6}
                              color={cfPalette.void}
                              uppercase
                            >
                              {unreadLabel}
                            </PixelText>
                          </View>
                        ) : (
                          isUnopened && (
                            <View style={styles.newPip}>
                              <PixelText
                                size={6}
                                color={cfPalette.void}
                                uppercase
                              >
                                new
                              </PixelText>
                            </View>
                          )
                        )}
                      </View>
                      <PixelText
                        size={7}
                        color={isDropped ? cfPalette.fog : cfPalette.ash}
                        style={styles.preview}
                      >
                        {preview}
                      </PixelText>
                      <PixelText
                        size={6}
                        color={cfPalette.fog}
                        style={{ marginTop: 4 }}
                      >
                        {`matched day ${m.matchedOnDay}`}
                      </PixelText>
                    </View>
                    <PixelText
                      size={7}
                      color={isDropped ? cfPalette.fog : cfPalette.purpleHot}
                      uppercase
                    >
                      ▸
                    </PixelText>
                  </PixelPanel>
                </Pressable>
              </Link>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: cfPalette.navyDeep,
    paddingHorizontal: 18,
  },
  title: {
    marginTop: 8,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 16,
  },
  passedNote: {
    marginTop: -10,
    marginBottom: 12,
  },
  list: {
    paddingBottom: Platform.OS === "web" ? 100 : 24,
    gap: 10,
  },
  empty: {
    padding: 28,
    alignItems: "center",
  },
  rowPress: {
    width: "100%",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  avatarWrap: {
    width: 48,
    height: 48,
  },
  avatar: {
    width: 48,
    height: 48,
  },
  body: {
    flex: 1,
    paddingHorizontal: 12,
  },
  bodyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  preview: {
    marginTop: 6,
    lineHeight: 11,
  },
  newPip: {
    backgroundColor: cfPalette.cyan,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: cfPalette.cyanHot,
  },
  droppedPip: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: cfPalette.fog,
  },
  rowDropped: {
    borderColor: cfPalette.fog,
  },
  unreadPip: {
    backgroundColor: cfPalette.pinkHot,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: cfPalette.pink,
    minWidth: 16,
    alignItems: "center",
  },
});
