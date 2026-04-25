/**
 * MessageFactGesture — reusable wrapper for chat message bubbles.
 *
 * The Pass 2 chat thread renders message bubbles. To keep the
 * "tap-and-hold to file as Fact" gesture from being duplicated in
 * every bubble variant, this component owns:
 *   - the long-press handler
 *   - the platform-correct delay
 *   - the call into `useGameState().commitFact`
 *   - de-dupe / no-op when the message is already filed
 *
 * Pass 2's chat UI just wraps each bubble:
 *
 *   <MessageFactGesture
 *     candidateId={msg.candidateId}
 *     threadId={thread.id}
 *     messageId={msg.id}
 *     quote={msg.body}
 *     // optional — guard against capturing the player's own messages
 *     disabled={msg.role === "player"}
 *   >
 *     <ChatBubble ... />
 *   </MessageFactGesture>
 *
 * The wrapped child stays interactive — Pressable forwards children
 * unchanged. We render a faint "filed" stripe when the message has
 * already been captured so the player gets visual confirmation.
 */

import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { PixelText } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";
import { CandidateId, MessageId, ThreadId } from "@/core/models";

interface MessageFactGestureProps {
  candidateId: CandidateId;
  threadId?: ThreadId;
  messageId: MessageId;
  quote: string;
  disabled?: boolean;
  /**
   * Optional callback so the chat UI can show its own toast / haptic
   * after a successful capture. Fired only when a NEW Fact lands;
   * de-duped re-captures resolve silently.
   */
  onCaptured?: () => void;
  children: React.ReactNode;
}

export function MessageFactGesture({
  candidateId,
  threadId,
  messageId,
  quote,
  disabled,
  onCaptured,
  children,
}: MessageFactGestureProps) {
  const commitFact = useGameState((s) => s.commitFact);
  const alreadyFiled = useGameState((s) =>
    Boolean(
      s.run?.facts.some(
        (f) => f.committed && f.capturedFromMessageId === messageId,
      ),
    ),
  );

  const handleLongPress = async () => {
    if (disabled) return;
    const before = alreadyFiled;
    const created = await commitFact({
      candidateId,
      threadId,
      messageId,
      quote,
    });
    if (!before && created) {
      onCaptured?.();
    }
  };

  return (
    <Pressable
      onLongPress={disabled ? undefined : handleLongPress}
      // 350ms feels right on mobile and is also Pressable's default;
      // pinning it explicitly so the gesture stays consistent across
      // any future Pressable variant changes.
      delayLongPress={Platform.OS === "web" ? 450 : 350}
      // No press feedback — long-press alone owns the gesture so
      // accidental short taps don't trip a flash.
      style={styles.wrap}
    >
      {children}
      {alreadyFiled && (
        <View style={styles.filedBadge} pointerEvents="none">
          <PixelText size={6} color={cfPalette.cyan} uppercase glow>
            filed
          </PixelText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
  },
  filedBadge: {
    position: "absolute",
    top: -6,
    right: -2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: cfPalette.cyan,
    backgroundColor: cfPalette.navyDeep,
  },
});
