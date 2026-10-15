import { describe, expect, it } from 'vitest';
import { tokens } from '@workspace/y-hub-ds/tokens';

const originalDarkPalette = {
  background: '#070b14',
  foreground: '#f8fafc',
  border: '#1e293b',
  card: '#0b1220',
  cardForeground: '#f8fafc',
  popover: '#0b1220',
  popoverForeground: '#f8fafc',
  primary: '#22d3ee',
  primaryForeground: '#071018',
  secondary: '#111827',
  secondaryForeground: '#f8fafc',
  muted: '#111827',
  mutedForeground: '#94a3b8',
  accent: '#8b5cf6',
  accentForeground: '#f8fafc',
  destructive: '#f87171',
  destructiveForeground: '#ffffff',
  input: '#1f2937',
  ring: '#22d3ee',
  chart1: '#22d3ee',
  chart2: '#f3ad55',
  chart3: '#60a5fa',
  chart4: '#f472b6',
  chart5: '#38bdf8',
  sidebar: '#050914',
  sidebarForeground: '#f3ead7',
  sidebarBorder: '#172033',
  sidebarPrimary: '#22d3ee',
  sidebarPrimaryForeground: '#071018',
  sidebarAccent: '#111827',
  sidebarAccentForeground: '#f3ead7',
  sidebarRing: '#22d3ee',
};

function luminance(hex: string): number {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error(`Invalid color: ${hex}`);
  }

  const channels = [0, 2, 4].map((start) => {
    const value = parseInt(normalized.slice(start, start + 2), 16) / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126
    + channels[1] * 0.7152
    + channels[2] * 0.0722;
}

function contrastRatio(a: string, b: string): number {
  const high = Math.max(luminance(a), luminance(b));
  const low = Math.min(luminance(a), luminance(b));
  return (high + 0.05) / (low + 0.05);
}

describe('Y-Hub theme contract', () => {
  it('keeps the original Dark Mode palette unchanged', () => {
    expect(tokens.color.dark).toEqual(originalDarkPalette);
  });

  it('defines matching semantic tokens in both modes', () => {
    expect(Object.keys(tokens.color.light).sort()).toEqual(
      Object.keys(tokens.color.dark).sort()
    );
  });

  it('uses the approved light theme', () => {
    expect(tokens.color.light.background).toBe('#F8FAFC');
    expect(tokens.color.light.foreground).toBe('#172B45');
    expect(tokens.color.light.secondary).toBe('#E8EDF3');
    expect(tokens.color.light.sidebar).toBe('#F1F5F9');
    expect(tokens.color.light.primary).toBe('#0E7490');
  });

  it('maintains WCAG AA contrast for core light text', () => {
    const light = tokens.color.light;

    const pairs = [
      [light.foreground, light.background],
      [light.cardForeground, light.card],
      [light.sidebarForeground, light.sidebar],
      [light.mutedForeground, light.background],
      [light.primaryForeground, light.primary],
      [light.secondaryForeground, light.secondary],
      [light.accentForeground, light.accent],
    ];

    for (const [foreground, background] of pairs) {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
