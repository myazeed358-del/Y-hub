/* GENERATED FROM tokens.json -- DO NOT EDIT. Run scripts/build-tokens.mjs. */
// Portable design tokens (colors as hex). Web consumes the theme via
// src/index.css; mobile (Expo) and any other platform import this object so the
// whole product shares one source of truth.
export const tokens = {
  "color": {
    "light": {
      "background": "#faf7f0",
      "foreground": "#242a45",
      "border": "#e1dbd0",
      "card": "#fefdfb",
      "cardForeground": "#242a45",
      "popover": "#fefdfb",
      "popoverForeground": "#242a45",
      "primary": "#27a283",
      "primaryForeground": "#fefdfb",
      "secondary": "#eee9db",
      "secondaryForeground": "#242a45",
      "muted": "#eee9de",
      "mutedForeground": "#6f7485",
      "accent": "#f3ad55",
      "accentForeground": "#1c243b",
      "destructive": "#dd3b36",
      "destructiveForeground": "#fefdfb",
      "input": "#d9d2c5",
      "ring": "#27a283",
      "chart1": "#27a283",
      "chart2": "#8b5cf6",
      "chart3": "#405477",
      "chart4": "#db7255",
      "chart5": "#4f9eb5",
      "sidebar": "#1c243b",
      "sidebarForeground": "#f8fafc",
      "sidebarBorder": "#303953",
      "sidebarPrimary": "#27a283",
      "sidebarPrimaryForeground": "#1c243b",
      "sidebarAccent": "#303953",
      "sidebarAccentForeground": "#f8fafc",
      "sidebarRing": "#27a283"
    },
    "dark": {
      "background": "#070b14",
      "foreground": "#f8fafc",
      "border": "#1e293b",
      "card": "#0b1220",
      "cardForeground": "#f8fafc",
      "popover": "#0b1220",
      "popoverForeground": "#f8fafc",
      "primary": "#22d3ee",
      "primaryForeground": "#071018",
      "secondary": "#111827",
      "secondaryForeground": "#f8fafc",
      "muted": "#111827",
      "mutedForeground": "#94a3b8",
      "accent": "#8b5cf6",
      "accentForeground": "#f8fafc",
      "destructive": "#f87171",
      "destructiveForeground": "#ffffff",
      "input": "#1f2937",
      "ring": "#22d3ee",
      "chart1": "#22d3ee",
      "chart2": "#f3ad55",
      "chart3": "#60a5fa",
      "chart4": "#f472b6",
      "chart5": "#38bdf8",
      "sidebar": "#050914",
      "sidebarForeground": "#f3ead7",
      "sidebarBorder": "#172033",
      "sidebarPrimary": "#22d3ee",
      "sidebarPrimaryForeground": "#071018",
      "sidebarAccent": "#111827",
      "sidebarAccentForeground": "#f3ead7",
      "sidebarRing": "#22d3ee"
    }
  },
  "fontFamily": {
    "sans": [
      "Cairo",
      "Noto Sans Arabic",
      "Inter",
      "sans-serif"
    ],
    "serif": [
      "Cairo",
      "Georgia",
      "serif"
    ],
    "mono": [
      "Space Mono",
      "IBM Plex Mono",
      "Menlo",
      "monospace"
    ]
  },
  "radius": "1rem",
  "spacing": "0.25rem"
} as const;

export type Tokens = typeof tokens;
export default tokens;
