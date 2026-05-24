/**
 * InstagrimApp — pixel-noir social-media background-check.
 *
 * Three layers of UI:
 *
 *   - **Candidate list** (cold launch): every match in the run with a
 *     post count chip. Mirrors the LinkedOut entry pattern.
 *
 *   - **Profile grid**: 3-column thumbnail grid of all visible posts
 *     for the chosen candidate. Each thumbnail is a code-drawn
 *     swatch (the data file authors a hex color per post) plus the
 *     caption beneath. Sparse for the killer until thread-pulling
 *     facts unlock more cells.
 *
 *   - **Post detail**: caption, timestamp, optional location. Opening
 *     a post linked to a factUniverse Instagram fact commits the fact
 *     to the Journal — re-using existing IG-kind facts like
 *     `miles_ig_window_reflection`.
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { AssetImage } from "@/components/AssetImage";
import { PixelText, ScanlineOverlay } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import type { Candidate } from "@/core/models";
import { type InstaPost, getInstagrimFor } from "@/core/onlineFootprint";
import { useGameState } from "@/core/gameStore";

function PostThumb({ post, onTap }: { post: InstaPost; onTap: () => void }) {
  return (
    <Pressable
      onPress={onTap}
      style={({ pressed }) => [
        styles.thumb,
        { backgroundColor: post.swatch },
        pressed && { opacity: 0.7 },
      ]}
      testID={`instagrim-post-${post.id}`}
    />
  );
}

function PostDetail({
  post,
  candidate,
  onBack,
  alreadyKnown,
}: {
  post: InstaPost;
  candidate: Candidate;
  onBack: () => void;
  alreadyKnown: boolean;
}) {
  return (
    <View style={styles.root}>
      <ScanlineOverlay />
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <PixelText size={8} color={cfPalette.cyan}>← back</PixelText>
        </Pressable>
        <PixelText size={9} color={cfPalette.bone} style={{ flex: 1, textAlign: "center" }}>
          instagrim
        </PixelText>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.postMeta}>
          <PixelText size={9} color={cfPalette.bone}>
            {candidate.displayName}
          </PixelText>
          <PixelText size={5} color={cfPalette.ash} style={{ marginTop: 2 }}>
            {post.timestamp}
            {post.location ? ` · ${post.location}` : ""}
          </PixelText>
        </View>
        <View style={[styles.postBig, { backgroundColor: post.swatch }]} />
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          <PixelText size={8} color={cfPalette.bone} style={{ lineHeight: 13 }}>
            {post.caption}
          </PixelText>
          {post.linkedFactId ? (
            alreadyKnown ? (
              <PixelText size={6} color={cfPalette.ash} style={{ marginTop: 16 }}>
                (already in journal)
              </PixelText>
            ) : (
              <PixelText size={7} color={cfPalette.greenBright} style={{ marginTop: 16 }}>
                ✓ post saved to journal
              </PixelText>
            )
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function ProfileGrid({
  candidate,
  posts,
  onPostTap,
  onBack,
}: {
  candidate: Candidate;
  posts: InstaPost[];
  onPostTap: (post: InstaPost) => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.root}>
      <ScanlineOverlay />
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn} testID="instagrim-back">
          <PixelText size={8} color={cfPalette.cyan}>← back</PixelText>
        </Pressable>
        <PixelText size={9} color={cfPalette.bone} style={{ flex: 1, textAlign: "center" }}>
          instagrim
        </PixelText>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.profileHeader}>
        <View style={styles.profileAvatar}>
          <AssetImage
            id={candidate.portraitAssetId ?? "A500_avatar_placeholder"}
            style={styles.profileAvatarImg}
            containerStyle={styles.profileAvatarImg}
            resizeMode="cover"
          />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <PixelText size={10} color={cfPalette.bone}>{candidate.displayName.toLowerCase()}</PixelText>
          <PixelText size={6} color={cfPalette.fog} style={{ marginTop: 4 }}>
            {posts.length} post{posts.length === 1 ? "" : "s"}
          </PixelText>
        </View>
      </View>
      {posts.length === 0 ? (
        <View style={styles.emptyState}>
          <PixelText size={8} color={cfPalette.ash} align="center">
            no public posts yet
          </PixelText>
          <PixelText size={6} color={cfPalette.fog} align="center" style={{ marginTop: 8, paddingHorizontal: 28, lineHeight: 11 }}>
            account looks fresh. dig elsewhere — a captured clue might surface posts that are hidden today.
          </PixelText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.gridContent}>
          <View style={styles.grid}>
            {posts.map((post) => (
              <PostThumb key={post.id} post={post} onTap={() => onPostTap(post)} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

export function InstagrimApp() {
  const run = useGameState((s) => s.run);
  const commitFact = useGameState((s) => s.commitFact);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [openPostId, setOpenPostId] = useState<string | null>(null);

  const candidates = run?.deck ?? [];
  const sorted = [...candidates].sort((a, b) => a.displayName.localeCompare(b.displayName));
  const knownFactIds = new Set<string>((run?.facts ?? []).map((f) => f.authoringKey));

  if (selectedCandidateId) {
    const candidate = candidates.find((c) => c.id === selectedCandidateId);
    if (!candidate) {
      setSelectedCandidateId(null);
      return null;
    }
    const posts = getInstagrimFor(candidate.displayName, run);
    if (openPostId) {
      const post = posts.find((p) => p.id === openPostId);
      if (post) {
        const alreadyKnown = !!post.linkedFactId && knownFactIds.has(post.linkedFactId);
        // Commit on first open — fire-and-forget so we don't block UI.
        if (post.linkedFactId && !alreadyKnown) {
          void commitFact({
            candidateId: candidate.id,
            quote: `[Instagrim] @${candidate.displayName.toLowerCase()}: ${post.caption}`,
          });
        }
        return (
          <PostDetail
            post={post}
            candidate={candidate}
            onBack={() => setOpenPostId(null)}
            alreadyKnown={alreadyKnown}
          />
        );
      }
    }
    return (
      <ProfileGrid
        candidate={candidate}
        posts={posts}
        onPostTap={(p) => setOpenPostId(p.id)}
        onBack={() => setSelectedCandidateId(null)}
      />
    );
  }

  return (
    <View style={styles.root}>
      <ScanlineOverlay />
      <View style={styles.header}>
        <PixelText size={11} color={cfPalette.bone}>
          instagrim
        </PixelText>
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
        <PixelText size={6} color={cfPalette.ash}>
          tap a name to view their feed
        </PixelText>
      </View>
      <ScrollView style={{ flex: 1 }}>
        {sorted.map((c) => {
          const postCount = getInstagrimFor(c.displayName, run).length;
          return (
            <Pressable
              key={c.id}
              onPress={() => setSelectedCandidateId(c.id)}
              testID={`instagrim-candidate-${c.id}`}
              style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]}
            >
              <View style={styles.listAvatar}>
                <AssetImage
                  id={c.portraitAssetId ?? "A500_avatar_placeholder"}
                  style={styles.listAvatarImg}
                  containerStyle={styles.listAvatarImg}
                  resizeMode="cover"
                />
              </View>
              <View style={{ flex: 1, paddingLeft: 10 }}>
                <PixelText size={9} color={cfPalette.bone}>
                  @{c.displayName.toLowerCase()}
                </PixelText>
                <PixelText size={6} color={cfPalette.fog} style={{ marginTop: 3 }}>
                  {postCount} post{postCount === 1 ? "" : "s"}
                </PixelText>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: cfPalette.navyDeep },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: cfPalette.iron,
  },
  backBtn: { width: 40 },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: cfPalette.iron,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: cfPalette.iron,
  },
  profileAvatarImg: { width: 56, height: 56 },
  gridContent: { padding: 4 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  thumb: {
    width: "33.33%",
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: "#0a0420",
  },
  postMeta: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  postBig: {
    width: "100%",
    aspectRatio: 1,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  listAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: cfPalette.iron,
  },
  listAvatarImg: { width: 40, height: 40 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
});
