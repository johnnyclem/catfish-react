/**
 * MessageFactGesture — reusable wrapper for chat message bubbles.
 *
 * Tap-and-hold a suspect's message to file it as a Fact in the Journal.
 * That gesture is the keystone of the detective loop: without captured
 * Facts the Accuse flow has no evidence to subset-match against, and
 * the Journal tab stays permanently empty.
 *
 * Implementation history:
 *   - v1 (Pass 2/3): Pressable.onLongPress + delayLongPress. Worked on
 *     iOS / Android, but onLongPress is unreliable under react-native-web
 *     (the synthetic mousedown/touchstart path drops the timer when the
 *     parent ScrollView claims the gesture). End-to-end testing in the
 *     web preview confirmed holds of 700ms+ never fired the handler.
 *   - v2 (this file): Gesture.LongPress() from react-native-gesture-handler,
 *     which has its own pointer-event pipeline that survives the
 *     ScrollView. The app already wraps everything in
 *     GestureHandlerRootView (see app/_layout.tsx) so no extra setup.
 *
 * Wraps each suspect bubble; player bubbles pass `disabled` so we don't
 * accidentally let the player capture their own replies as evidence.
 *
 *   <MessageFactGesture
 *     candidateId={candidate.id}
 *     threadId={thread.id}
 *     messageId={msg.id}
 *     quote={msg.text}
 *     disabled={msg.sender === "player"}
 *   >
 *     <MessageBubble message={msg} />
 *   </MessageFactGesture>
 *
 * Visual feedback on capture:
 *   - The wrapped bubble briefly flashes (200ms) with a cyan glow so
 *     the player sees the gesture landed even before they look at the
 *     Journal.
 *   - A small "FILED" badge pins to the top-right of any bubble whose
 *     message id is already in `run.facts` (idempotent re-captures
 *     stay visible across re-renders).
 *   - On native, a light haptic fires via expo-haptics. No-op on web.
 */

import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

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

const LONG_PRESS_MS = 450;

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

  // 200ms flash overlay — the bubble briefly glows cyan when a new
  // capture lands so the player gets immediate feedback, not just
  // "the badge appeared, did anything happen?".
  const flashAnim = useRef(new Animated.Value(0)).current;
  const [pressedDown, setPressedDown] = useState(false);

  // Press-and-hold visual hint: the bubble fades to ~70% opacity once
  // the gesture-handler arms it, telling the player "yes I'm holding,
  // keep going". Without this the long-press feels like nothing is
  // happening for half a second.
  useEffect(() => {
    if (!pressedDown) return;
    return () => setPressedDown(false);
  }, [pressedDown]);

  const handleCapture = async () => {
    if (disabled) return;
    const before = alreadyFiled;
    const created = await commitFact({
      candidateId,
      threadId,
      messageId,
      quote,
    });
    if (!before && created) {
      // Light haptic on native — no-op on web (expo-haptics ships a
      // web stub that resolves immediately).
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      // Cyan flash — fade in fast, fade out a touch slower for a
      // satisfying "snap" feel.
      flashAnim.setValue(0);
      Animated.sequence([
        Animated.timing(flashAnim, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(flashAnim, {
          toValue: 0,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start();
      onCaptured?.();
    }
  };

  // ── react-native-gesture-handler LongPress ────────────────────────
  // `.runOnJS(true)` opts out of the worklet runtime so we can call
  // the async `commitFact` action directly without `runOnJS(...)`
  // wrappers. This is the right call for a simple "user held a
  // message, file it" gesture — there's no per-frame animation to
  // drive on the UI thread.
  //
  // `.maxDistance(20)` lets the player wiggle a little without
  // cancelling the press (otherwise scrolling intent in the
  // ScrollView ancestor cancels it the moment the finger drifts).
  const gesture = Gesture.LongPress()
    .enabled(!disabled)
    .minDuration(LONG_PRESS_MS)
    .maxDistance(20)
    .runOnJS(true)
    .onBegin(() => setPressedDown(true))
    .onStart(() => {
      handleCapture();
    })
    .onFinalize(() => setPressedDown(false));

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.wrap}>
        <Animated.View
          style={{
            opacity: pressedDown ? 0.72 : 1,
          }}
        >
          {children}
        </Animated.View>
        {/* Capture flash — cyan overlay on top of the bubble */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            styles.flash,
            { opacity: flashAnim },
          ]}
        />
        {alreadyFiled && (
          <View style={styles.filedBadge} pointerEvents="none">
            <PixelText size={6} color={cfPalette.cyan} uppercase glow>
              filed
            </PixelText>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
  },
  flash: {
    backgroundColor: cfPalette.cyan,
    // Above the bubble's own border so the flash actually shows.
    borderRadius: 4,
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
