export type ThemePreference = 'system' | 'light' | 'dark';

const ORDER: readonly ThemePreference[] = ['system', 'light', 'dark'];

/** Page colours for the browser UI (address bar on phones). Match --paper in tokens.css. */
const THEME_COLORS = { light: '#f3f0e8', dark: '#131210' } as const;

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function nextTheme(current: ThemePreference): ThemePreference {
  return ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? 'system';
}

/**
 * `system` follows the operating system through `color-scheme: light dark`;
 * the other two pin the scheme with `data-theme` on <html>.
 */
export function applyTheme(root: HTMLElement, preference: ThemePreference): void {
  if (preference === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', preference);

  for (const meta of root.ownerDocument.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  )) {
    const scheme = meta.media.includes('dark') ? 'dark' : 'light';
    meta.content = THEME_COLORS[preference === 'system' ? scheme : preference];
  }
}
