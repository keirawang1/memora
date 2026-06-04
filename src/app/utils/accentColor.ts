import { DEFAULT_ACCENT_COLOR } from '../data/defaults';

export function normalizeAccentColor(value: string | null | undefined): string {
  if (!value) return DEFAULT_ACCENT_COLOR;
  const trimmed = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return DEFAULT_ACCENT_COLOR;
}

export function isValidAccentHex(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/i.test(value.trim());
}

export function hexWithAlpha(hex: string, alpha: number): string {
  const normalized = normalizeAccentColor(hex).slice(1);
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function accentGradientBackground(accentColor: string): string {
  return `linear-gradient(to bottom right, ${hexWithAlpha(accentColor, 0.12)}, ${hexWithAlpha(accentColor, 0.28)})`;
}
