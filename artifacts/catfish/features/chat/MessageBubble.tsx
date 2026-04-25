/**
 * MessageBubble — pixel-art chat line.
 *
 * Suspect messages anchor left in cyan; player replies anchor right in
 * pink-hot. Glow + 2px borders mirror the rest of the PixelChrome system
 * so the chat reads as part of the same world as the swipe deck.
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

  return (
    <View style={[styles.row, { justifyContent: align }]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: bg,
            borderColor: border,
            // Soften the corner that points "into" the conversation. Pixel
            // borders so we stay on grid.
            borderTopLeftRadius: isPlayer ? 6 : 0,
            borderTopRightRadius: isPlayer ? 0 : 6,
          },
        ]}
      >
        <PixelText size={9} color={fg} style={{ lineHeight: 14 }}>
          {message.text}
        </PixelText>
      </View>
    </View>
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
});
