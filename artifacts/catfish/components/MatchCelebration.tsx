/**
 * MatchCelebration — full-screen overlay shown after a right-swipe.
 * Translated from the SwiftUI MatchOverlay step in the source doc:
 * "celebratory but cheap; lasts ~1.6s, dismissible, queued via swipe()."
 */

import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { AssetImage } from "./AssetImage";
import { NeonButton, PixelPanel, PixelText } from "./PixelChrome";

import { cfPalette } from "@/constants/colors";
import { emitSfx } from "@/features/audio/audioEvents";

interface MatchCelebrationProps {
  visible: boolean;
  candidateName: string;
  onDismiss: () => void;
}

export function MatchCelebration({
  visible,
  candidateName,
  onDismiss,
}: MatchCelebrationProps) {
  const heartScale = useRef(new Animated.Value(0.4)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      heartScale.setValue(0.4);
      fade.setValue(0);
      return;
    }
    // Triumphant arpeggio — coincides with the heart-pop spring so
    // the bass note lands as the heart reaches full size.
    emitSfx("match");
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(heartScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 6,
        stiffness: 110,
      }),
    ]).start();

    // Auto-dismiss after ~1.6s per the source spec. Tap-to-dismiss still
    // works via the Pressable underneath.
    const t = setTimeout(() => {
      onDismiss();
    }, 1600);
    return () => clearTimeout(t);
  }, [visible, fade, heartScale, onDismiss]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.overlay, { opacity: fade }]}
      pointerEvents="auto"
      testID="match-celebration"
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          style={{
            transform: [{ scale: heartScale }],
            alignItems: "center",
          }}
        >
          <AssetImage
            id="A200_match_overlay"
            style={styles.bigArt}
            containerStyle={styles.bigArtContainer}
          />
        </Animated.View>

        <PixelPanel style={styles.banner} variant="raised">
          <PixelText size={14} color={cfPalette.pinkHot} glow uppercase align="center">
            it's a match
          </PixelText>
          <PixelText size={9} color={cfPalette.bone} align="center" style={{ marginTop: 10 }}>
            {candidateName} swiped on you too.
          </PixelText>
          <PixelText size={7} color={cfPalette.ash} align="center" style={{ marginTop: 8 }}>
            (the case begins)
          </PixelText>
        </PixelPanel>

        <NeonButton
          label="Keep Looking"
          variant="primary"
          onPress={onDismiss}
          style={{ marginTop: 24 }}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(3,1,10,0.92)",
    zIndex: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  bigArtContainer: {
    width: 220,
    height: 220,
  },
  bigArt: {
    width: 220,
    height: 220,
  },
  banner: {
    marginTop: 24,
    paddingVertical: 22,
    paddingHorizontal: 24,
    minWidth: 280,
  },
});
