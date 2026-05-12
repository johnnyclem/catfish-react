/**
 * Catfish — pixel-art neon palette.
 *
 * Mirrors the original SwiftUI CFColor system. Single dark theme — the game
 * is a moody pixel-art mystery, so we don't ship a light variant.
 */

const palette = {
  navyDeep: "#0a0420",
  navy: "#10082c",
  navyHi: "#1a1040",
  panel: "#1c0f3a",
  panelHi: "#2a1858",

  pinkHot: "#ff2f8f",
  pink: "#ff5cb1",
  pinkSoft: "#ffb1d8",

  cyan: "#22e0ff",
  cyanHot: "#5cf2ff",

  purple: "#7a3cff",
  purpleHot: "#a96bff",

  truth: "#ff2f8f",
  lies: "#22e0ff",

  bone: "#f7f1ff",
  ash: "#a797d4",
  fog: "#5e4f8a",
  iron: "#322057",
  void: "#03010a",

  warn: "#ffb347",
  err: "#ff3860",
  ok: "#3cd296",
  greenBright: "#3effa0",
  redHot: "#ff4060",
};

const colors = {
  light: {
    text: palette.bone,
    tint: palette.pinkHot,

    background: palette.navyDeep,
    foreground: palette.bone,

    card: palette.panel,
    cardForeground: palette.bone,

    primary: palette.pinkHot,
    primaryForeground: palette.void,

    secondary: palette.purple,
    secondaryForeground: palette.bone,

    muted: palette.iron,
    mutedForeground: palette.ash,

    accent: palette.cyan,
    accentForeground: palette.void,

    destructive: palette.err,
    destructiveForeground: palette.bone,

    border: palette.purple,
    input: palette.iron,
  },
  radius: 0,
};

export const cfPalette = palette;
export default colors;
