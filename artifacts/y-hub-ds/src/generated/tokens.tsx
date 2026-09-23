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
      "chart2": "#f3ad55",
      "chart3": "#405477",
      "chart4": "#db7255",
      "chart5": "#4f9eb5",
      "sidebar": "#1c243b",
      "sidebarForeground": "#f3ead7",
      "sidebarBorder": "#303953",
      "sidebarPrimary": "#27a283",
      "sidebarPrimaryForeground": "#1c243b",
      "sidebarAccent": "#303953",
      "sidebarAccentForeground": "#f3ead7",
      "sidebarRing": "#27a283"
    },
    "dark": {
      "background": "#121828",
      "foreground": "#f3ead7",
      "border": "#2c344d",
      "card": "#1c243b",
      "cardForeground": "#f3ead7",
      "popover": "#1c243b",
      "popoverForeground": "#f3ead7",
      "primary": "#2aaf91",
      "primaryForeground": "#121828",
      "secondary": "#252d45",
      "secondaryForeground": "#f3ead7",
      "muted": "#252d45",
      "mutedForeground": "#c5baa0",
      "accent": "#f3ad55",
      "accentForeground": "#121828",
      "destructive": "#e44f4a",
      "destructiveForeground": "#121828",
      "input": "#39435c",
      "ring": "#2aaf91",
      "chart1": "#2aaf91",
      "chart2": "#f3ad55",
      "chart3": "#6d8ab6",
      "chart4": "#e47c5b",
      "chart5": "#61b9d1",
      "sidebar": "#0d1220",
      "sidebarForeground": "#f3ead7",
      "sidebarBorder": "#252d45",
      "sidebarPrimary": "#2aaf91",
      "sidebarPrimaryForeground": "#0d1220",
      "sidebarAccent": "#252d45",
      "sidebarAccentForeground": "#f3ead7",
      "sidebarRing": "#2aaf91"
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
