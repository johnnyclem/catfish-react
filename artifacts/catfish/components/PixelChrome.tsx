/**
 * PixelChrome — translated from the SwiftUI DesignSystem modifiers
 * (panel, scanline overlay, glitch overlay, neon button) in the source
 * Pass 1 doc.
 */

import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { cfPalette } from "@/constants/colors";

export const PIXEL_FONT = "PressStart2P_400Regular";

/* ─────────────────────────── PixelText ───────────────────────────────── */

interface PixelTextProps {
  children: React.ReactNode;
  size?: number;
  color?: string;
  style?: StyleProp<any>;
  align?: "left" | "center" | "right";
  glow?: boolean;
  uppercase?: boolean;
}

export function PixelText({
  children,
  size = 10,
  color = cfPalette.bone,
  style,
  align = "left",
  glow = false,
  uppercase = false,
}: PixelTextProps) {
  return (
    <Text
      style={[
        {
          fontFamily: PIXEL_FONT,
          fontSize: size,
          color,
          textAlign: align,
          letterSpacing: 0.5,
          textTransform: uppercase ? "uppercase" : "none",
          lineHeight: Math.round(size * 1.5),
        },
        glow && {
          textShadowColor: color,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 12,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/* ─────────────────────────── PixelPanel ──────────────────────────────── */

interface PixelPanelProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: "default" | "raised" | "ghost";
  borderColor?: string;
}

export function PixelPanel({
  children,
  style,
  variant = "default",
  borderColor,
}: PixelPanelProps) {
  const bg =
    variant === "ghost"
      ? "transparent"
      : variant === "raised"
        ? cfPalette.panelHi
        : cfPalette.panel;
  const border = borderColor ?? cfPalette.purple;

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderWidth: 2,
          borderColor: border,
        },
        style,
      ]}
    >
      {children}
      <View pointerEvents="none" style={styles.cornerTL} />
      <View pointerEvents="none" style={styles.cornerTR} />
      <View pointerEvents="none" style={styles.cornerBL} />
      <View pointerEvents="none" style={styles.cornerBR} />
    </View>
  );
}

/* ─────────────────────────── ScanlineOverlay ─────────────────────────── */

export function ScanlineOverlay({
  intensity = 0.06,
  step = 3,
}: {
  intensity?: number;
  step?: number;
}) {
  // Build a stack of 1px lines at every `step` pixels.
  const lines = [];
  for (let i = 0; i < 200; i++) {
    lines.push(
      <View
        key={i}
        style={{
          height: 1,
          marginBottom: step - 1,
          backgroundColor: `rgba(0,0,0,${intensity})`,
        }}
      />,
    );
  }
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {lines}
    </View>
  );
}

/* ─────────────────────────── NeonButton ──────────────────────────────── */

type NeonVariant = "primary" | "secondary" | "danger" | "ghost";

interface NeonButtonProps extends Omit<PressableProps, "style"> {
  label: string;
  variant?: NeonVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function NeonButton({
  label,
  variant = "primary",
  size = "md",
  loading,
  fullWidth,
  style,
  disabled,
  ...rest
}: NeonButtonProps) {
  const palette = (() => {
    switch (variant) {
      case "secondary":
        return { bg: cfPalette.cyan, fg: cfPalette.void, border: cfPalette.cyanHot };
      case "danger":
        return { bg: cfPalette.err, fg: cfPalette.bone, border: cfPalette.pink };
      case "ghost":
        return { bg: "transparent", fg: cfPalette.cyan, border: cfPalette.cyan };
      case "primary":
      default:
        return { bg: cfPalette.pinkHot, fg: cfPalette.void, border: cfPalette.pinkSoft };
    }
  })();

  const py = size === "sm" ? 8 : size === "lg" ? 18 : 12;
  const px = size === "sm" ? 14 : size === "lg" ? 28 : 20;
  const fontSize = size === "sm" ? 9 : size === "lg" ? 14 : 11;

  return (
    <Pressable
      {...rest}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: palette.bg,
          borderWidth: 2,
          borderColor: palette.border,
          paddingVertical: py,
          paddingHorizontal: px,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
          transform: [{ translateY: pressed ? 1 : 0 }],
          alignSelf: fullWidth ? "stretch" : "flex-start",
        },
        Platform.OS !== "web" && {
          shadowColor: palette.bg,
          shadowOpacity: 0.7,
          shadowRadius: 0,
          shadowOffset: { width: 3, height: 3 },
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text
          style={{
            fontFamily: PIXEL_FONT,
            fontSize,
            color: palette.fg,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/* ─────────────────────────── styles ──────────────────────────────────── */

const CORNER = 6;
const styles = StyleSheet.create({
  cornerTL: {
    position: "absolute",
    top: -2,
    left: -2,
    width: CORNER,
    height: CORNER,
    backgroundColor: cfPalette.pinkHot,
  },
  cornerTR: {
    position: "absolute",
    top: -2,
    right: -2,
    width: CORNER,
    height: CORNER,
    backgroundColor: cfPalette.cyan,
  },
  cornerBL: {
    position: "absolute",
    bottom: -2,
    left: -2,
    width: CORNER,
    height: CORNER,
    backgroundColor: cfPalette.cyan,
  },
  cornerBR: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: CORNER,
    height: CORNER,
    backgroundColor: cfPalette.pinkHot,
  },
});
