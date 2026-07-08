import { DEFAULT_ACCENT_COLOR } from '../data/defaults';
import { getContrastTextColor, normalizeAccentColor } from './accentColor';

export type AppThemeMode = 'light' | 'dark' | 'custom';

export interface AppThemeSettings {
  mode: AppThemeMode;
  backgroundColor: string;
  customAccentColor: string;
}

export const LIGHT_THEME_BACKGROUND = '#ffffff';
export const DARK_THEME_BACKGROUND = '#000000';
export const DARK_THEME_ACCENT = '#ffffff';
export const DIALOG_LIGHT_BACKGROUND = '#ffffff';
export const DIALOG_DARK_BACKGROUND = '#000000';

const THEME_OVERRIDE_PROPS = ['--background'] as const;

const DIALOG_CSS_PROPS = [
  '--dialog',
  '--dialog-foreground',
  '--dialog-muted-foreground',
  '--dialog-border',
] as const;

export function createDefaultThemeSettings(
  accentColor = DEFAULT_ACCENT_COLOR,
): AppThemeSettings {
  return {
    mode: 'light',
    backgroundColor: LIGHT_THEME_BACKGROUND,
    customAccentColor: normalizeAccentColor(accentColor),
  };
}

export function parseThemeMode(value: unknown): AppThemeMode {
  if (value === 'light' || value === 'dark' || value === 'custom') {
    return value;
  }
  return 'light';
}

export function resolveThemeAccent(settings: AppThemeSettings): string {
  switch (settings.mode) {
    case 'dark':
      return DARK_THEME_ACCENT;
    case 'custom':
      return normalizeAccentColor(settings.customAccentColor);
    default:
      return DEFAULT_ACCENT_COLOR;
  }
}

export function resolveThemeBackground(settings: AppThemeSettings): string {
  switch (settings.mode) {
    case 'dark':
      return DARK_THEME_BACKGROUND;
    case 'custom':
      return normalizeAccentColor(settings.backgroundColor);
    default:
      return LIGHT_THEME_BACKGROUND;
  }
}

function hexLuminance(hex: string): number {
  const normalized = normalizeAccentColor(hex).slice(1);
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function clearThemeOverrides(root: HTMLElement): void {
  for (const prop of THEME_OVERRIDE_PROPS) {
    root.style.removeProperty(prop);
  }
}

function applyAccentVars(root: HTMLElement, accent: string): void {
  root.style.setProperty('--user-accent', accent);
  root.style.setProperty('--user-accent-foreground', getContrastTextColor(accent));
}

function applyDialogVars(root: HTMLElement, settings: AppThemeSettings): void {
  if (settings.mode === 'dark') {
    root.style.setProperty('--dialog', DIALOG_DARK_BACKGROUND);
    root.style.setProperty('--dialog-foreground', '#fafafa');
    root.style.setProperty('--dialog-muted-foreground', '#a1a1aa');
    root.style.setProperty('--dialog-border', '#27272a');
    return;
  }

  root.style.setProperty('--dialog', DIALOG_LIGHT_BACKGROUND);
  root.style.setProperty('--dialog-foreground', '#030213');
  root.style.setProperty('--dialog-muted-foreground', '#717182');
  root.style.setProperty('--dialog-border', 'rgba(0, 0, 0, 0.1)');
}

function clearDialogVars(root: HTMLElement): void {
  for (const prop of DIALOG_CSS_PROPS) {
    root.style.removeProperty(prop);
  }
}

export function applyAppTheme(settings: AppThemeSettings): string {
  const root = document.documentElement;
  const accent = resolveThemeAccent(settings);
  const background = resolveThemeBackground(settings);

  clearThemeOverrides(root);
  clearDialogVars(root);
  applyAccentVars(root, accent);
  applyDialogVars(root, settings);

  if (settings.mode === 'light') {
    root.classList.remove('dark');
    return accent;
  }

  if (settings.mode === 'dark') {
    root.classList.add('dark');
    root.style.setProperty('--background', DARK_THEME_BACKGROUND);
    return accent;
  }

  const useDarkUi = hexLuminance(background) < 0.5;
  root.classList.toggle('dark', useDarkUi);
  root.style.setProperty('--background', background);

  return accent;
}
