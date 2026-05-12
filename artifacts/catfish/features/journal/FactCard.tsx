/**
 * FactCard — single Fact rendered inside a SuspectGroup.
 *
 * Unified card that handles both authored and captured Facts:
 *   - Authored (static/variable/conditional): shows `payload.text`, a
 *     source badge (bio / IG / portrait expression), and `day` stamp.
 *     No discard affordance — authored facts are world-logged, not
 *     player-owned.
 *   - Captured: shows `capturedQuote`, day from `capturedOnDay`, and
 *     an ✕ discard chip. This is the Pass 3 "long-press to file" path.
 *
 * The `fact.kind` discriminator determines which content path is used.
 */

import { Pressable, StyleSheet, View } from "react-native";

import { PixelPanel, PixelText } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { Fact } from "@/core/models";

interface FactCardProps {
  fact: Fact;
  onDiscard?: (factId: string) => void;
  onPress?: (fact: Fact) => void;
}

function SourceBadge({ source }: { source: Fact["source"] }): React.ReactElement {
  let label: string;
  let color = cfPalette.ash;
  switch (source.kind) {
    case "bio":
      label = "bio";
      color = cfPalette.cyan;
      break;
    case "instagram":
      label = "IG";
      color = cfPalette.cyanHot;
      break;
    case "portrait":
      label = source.expression;
      color = cfPalette.purple;
      break;
    case "devText":
      label = "dev";
      color = cfPalette.pinkHot;
      break;
    case "friendText":
      label = source.friend;
      color = cfPalette.cyan;
      break;
    case "chatMessage":
      label = "chat";
      color = cfPalette.fog;
      break;
    case "narratorBeat":
      label = "narration";
      color = cfPalette.fog;
      break;
    default:
      label = "fact";
  }
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <PixelText size={5} color={color} uppercase>
        {label}
      </PixelText>
    </View>
  );
}

function AuthoredContent({ text, day, source }: { text: string; day: number; source: Fact["source"] }) {
  return (
    <>
      <View style={styles.header}>
        <PixelText size={6} color={cfPalette.ash} uppercase>
          {`day ${day}`}
        </PixelText>
        <SourceBadge source={source} />
      </View>
      <View style={styles.quoteRow}>
        <PixelText size={11} color={cfPalette.purpleHot} style={styles.quoteGlyph}>
          "
        </PixelText>
        <PixelText size={9} color={cfPalette.bone} style={styles.quoteBody}>
          {text}
        </PixelText>
      </View>
    </>
  );
}

function CapturedContent({ quote, day }: { quote: string; day: number }) {
  return (
    <>
      <View style={styles.header}>
        <PixelText size={6} color={cfPalette.cyan} uppercase>
          {`day ${day}`}
        </PixelText>
      </View>
      <View style={styles.quoteRow}>
        <PixelText size={11} color={cfPalette.purpleHot} style={styles.quoteGlyph}>
          "
        </PixelText>
        <PixelText size={9} color={cfPalette.bone} style={styles.quoteBody}>
          {quote}
        </PixelText>
      </View>
    </>
  );
}

export function FactCard({ fact, onDiscard, onPress }: FactCardProps) {
  const isCaptured = fact.kind === "captured";
  const quote = fact.capturedQuote ?? "(missing quote)";
  const day = isCaptured ? fact.capturedOnDay ?? 0 : fact.day;

  return (
    <PixelPanel variant="default" style={styles.card}>
      <Pressable
        onPress={() => onPress?.(fact)}
        style={({ pressed }) => [pressed && onPress && { opacity: 0.75 }]}
        disabled={!onPress}
      >
        {isCaptured ? (
          <CapturedContent quote={quote} day={day} />
        ) : (
          <AuthoredContent text={fact.payload.text ?? ""} day={fact.day} source={fact.source} />
        )}
      </Pressable>

      {isCaptured && onDiscard && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Discard fact"
          hitSlop={10}
          onPress={() => onDiscard(fact.id)}
          style={({ pressed }) => [
            styles.discard,
            pressed && { opacity: 0.6 },
          ]}
        >
          <PixelText size={8} color={cfPalette.ash} uppercase>
            ✕
          </PixelText>
        </Pressable>
      )}
    </PixelPanel>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
  },
  discard: {
    position: "absolute",
    top: 10,
    right: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: cfPalette.fog,
  },
  quoteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  quoteGlyph: {
    marginRight: 6,
    marginTop: -2,
    lineHeight: 12,
  },
  quoteBody: {
    flex: 1,
    lineHeight: 14,
  },
});