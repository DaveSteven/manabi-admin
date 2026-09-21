// TypeScript mirror of src/styles/_tokens.scss for values consumed by JS
// (Ant Design theme and status tags). Keep both files in sync.
export const palette = {
  primary: '#4255ff',
  primaryHover: '#5869ff',
  primaryLight: '#eef0ff',
  textPrimary: '#282e3e',
  textSecondary: '#697386',
  background: '#f6f7fb',
  surface: '#ffffff',
  border: '#e6e8f0',
  success: '#23a877',
  warning: '#f2b729',
  error: '#d9363e',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 22,
  pill: 99,
} as const;

export const typography = {
  sans: '"Inter", "Noto Sans SC", "Noto Sans JP", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
} as const;
