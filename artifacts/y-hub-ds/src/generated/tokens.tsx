/* GENERATED FROM tokens.json -- DO NOT EDIT. Run scripts/build-tokens.mjs. */
// Portable design tokens (colors as hex). Web consumes the theme via
// src/index.css; mobile (Expo) and any other platform import this object so the
// whole product shares one source of truth.
export const tokens = {
  "color": {
    "light": {
      "background": "#F8FAFC",
      "foreground": "#172B45",
      "border": "#D5E0EA",
      "card": "#FFFFFF",
      "cardForeground": "#172B45",
      "popover": "#FFFFFF",
      "popoverForeground": "#172B45",
      "primary": "#0E7490",
      "primaryForeground": "#FFFFFF",
      "secondary": "#E8EDF3",
      "secondaryForeground": "#172B45",
      "muted": "#EDF2F7",
      "mutedForeground": "#475569",
      "accent": "#DDBB78",
      "accentForeground": "#172B45",
      "destructive": "#dd3b36",
      "destructiveForeground": "#fefdfb",
      "input": "#CBD5E1",
      "ring": "#0E7490",
      "chart1": "#27a283",
      "chart2": "#8b5cf6",
      "chart3": "#405477",
      "chart4": "#db7255",
      "chart5": "#4f9eb5",
      "sidebar": "#F1F5F9",
      "sidebarForeground": "#172B45",
      "sidebarBorder": "#CBD5E1",
      "sidebarPrimary": "#0E7490",
      "sidebarPrimaryForeground": "#FFFFFF",
      "sidebarAccent": "#E8EDF3",
      "sidebarAccentForeground": "#172B45",
      "sidebarRing": "#0E7490"
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
