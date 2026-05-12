import { useCallback, useRef, useState } from "react";
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  StyleSheet,
  View,
} from "react-native";

import { cfPalette } from "@/constants/colors";

interface PixelSliderProps {
  value: number;
  onValueChange: (v: number) => void;
  disabled?: boolean;
}

const TRACK_H = 6;
const THUMB_SIZE = 14;

export function PixelSlider({ value, onValueChange, disabled }: PixelSliderProps) {
  const trackWidthRef = useRef(1);
  const trackXRef = useRef(0);
  const [dragging, setDragging] = useState(false);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    trackWidthRef.current = e.nativeEvent.layout.width;
    trackXRef.current = e.nativeEvent.layout.x ?? 0;
  }, []);

  const ratioFromEvent = useCallback((e: GestureResponderEvent) => {
    const x = e.nativeEvent.pageX - trackXRef.current;
    const w = trackWidthRef.current;
    if (w <= 0) return value;
    return Math.max(0, Math.min(1, x / w));
  }, [value]);

  const handleTouch = useCallback((e: GestureResponderEvent) => {
    if (disabled) return;
    onValueChange(Math.round(ratioFromEvent(e) * 100) / 100);
  }, [disabled, onValueChange, ratioFromEvent]);

  const fillRatio = value;

  return (
    <View
      onLayout={handleLayout}
      onStartShouldSetResponder={() => !disabled}
      onMoveShouldSetResponder={() => !disabled}
      onResponderGrant={handleTouch}
      onResponderMove={handleTouch}
      onResponderRelease={() => setDragging(false)}
      onResponderTerminate={() => setDragging(false)}
      style={[styles.track, disabled && styles.disabled]}
    >
      <View style={[styles.fill, { width: `${Math.round(fillRatio * 100)}%` as any }]} />
      <View
        style={[
          styles.thumb,
          { left: `${Math.round(fillRatio * 100)}%` as any, marginLeft: -THUMB_SIZE / 2 },
          dragging && styles.thumbActive,
          disabled && styles.thumbDisabled,
        ]}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_H,
    backgroundColor: cfPalette.iron,
    borderRadius: 3,
    position: "relative",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.4,
  },
  fill: {
    height: TRACK_H,
    backgroundColor: cfPalette.cyan,
    borderRadius: 3,
    position: "absolute",
    left: 0,
    top: 0,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: cfPalette.bone,
    borderWidth: 2,
    borderColor: cfPalette.cyan,
    position: "absolute",
    top: (TRACK_H - THUMB_SIZE) / 2,
  },
  thumbActive: {
    backgroundColor: cfPalette.bone,
    borderColor: cfPalette.pinkHot,
  },
  thumbDisabled: {
    backgroundColor: cfPalette.ash,
    borderColor: cfPalette.iron,
  },
});
