import { expect, test } from 'vitest';
import { isThemePreference, nextTheme } from './theme';

test('cycles system → light → dark → system', () => {
  expect(nextTheme('system')).toBe('light');
  expect(nextTheme('light')).toBe('dark');
  expect(nextTheme('dark')).toBe('system');
});

test('validates stored values', () => {
  expect(isThemePreference('dark')).toBe(true);
  expect(isThemePreference('blue')).toBe(false);
  expect(isThemePreference(null)).toBe(false);
});
