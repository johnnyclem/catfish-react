/**
 * MessageBubble — pixel-art chat line.
 *
 * Suspect messages anchor left in cyan; player replies anchor right in
 * pink-hot. Glow + 2px borders mirror the rest of the PixelChrome system
 * so the chat reads as part of the same world as the swipe deck.
 *
 * Task #63 — player bubbles show a delivery status tick below the text:
 *   "sent"     → one tick (cyan)
 *   "delivered"→ two ticks (cyan)
 *   "read"     → two ticks (pink-hot)
 * Suspect messages show no indicator.
 */

import { StyleSheet, View } from "react-native";

import { PixelText } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { Message } from "@/core/models";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isPlayer = message.sender === "player";
  const align = isPlayer ? "flex-end" : "flex-start";
  const bg = isPlayer ? cfPalette.pinkHot : cfPalette.panel;
  const border = isPlayer ? cfPalette.pinkSoft : cfPalette.cyan;
  const fg = isPlayer ? cfPalette.void : cfPalette.bone;

  const status = message.status;

  return (
    <View style={[styles.row, { justifyContent: align }]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: bg,
            borderColor: border,
            borderTopLeftRadius: isPlayer ? 6 : 0,
            borderTopRightRadius: isPlayer ? 0 : 6,
          },
        ]}
      >
        <PixelText size={9} color={fg} style={{ lineHeight: 14 }}>
          {message.text}
        </PixelText>
        {isPlayer && status != null && (
          <StatusTick status={status} />
        )}
      </View>
    </View>
  );
}

function StatusTick({ status }: { status: "sent" | "delivered" | "read" }) {
  const color =
    status === "read" ? cfPalette.pinkHot : cfPalette.cyan;
  const label = status === "sent" ? "✓" : status === "delivered" ? "✓✓" : "✓✓";
  return (
    <PixelText
      size={6}
      color={color}
      style={styles.statusTick}
    >
      {label}
    </PixelText>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    paddingHorizontal: 4,
    marginVertical: 4,
  },
  bubble: {
    maxWidth: "82%",
    borderWidth: 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  statusTick: {
    marginTop: 4,
    textAlign: "right",
  },
});
