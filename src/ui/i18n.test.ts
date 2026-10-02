import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { detectLocale, isMessageKey, translator } from './i18n';

describe('detectLocale', () => {
  test('?lang= wins', () => {
    expect(detectLocale('?lang=en', 'ru', ['ru-RU'])).toBe('en');
  });

  test('then the saved choice', () => {
    expect(detectLocale('', 'ru', ['en-US'])).toBe('ru');
  });

  test('then the first Russian or English browser language', () => {
    expect(detectLocale('', null, ['ru-RU', 'en'])).toBe('ru');
    expect(detectLocale('', null, ['de-DE', 'en-GB', 'ru'])).toBe('en');
    expect(detectLocale('', null, ['de-DE', 'ru'])).toBe('ru');
  });

  test('English otherwise, and junk is ignored', () => {
    expect(detectLocale('?lang=xx', 'fr', ['de', 'fr'])).toBe('en');
    expect(detectLocale('', null, [])).toBe('en');
  });
});

describe('translator', () => {
  test('fills placeholders and keeps unknown ones visible', () => {
    const t = translator('ru');
    expect(t('toast.copied', { value: '42' })).toBe('Скопировано: 42');
    expect(t('toast.copied')).toBe('Скопировано: {value}');
    expect(translator('en')('toast.copied', { value: '42' })).toBe('Copied: 42');
  });
});

describe('index.html', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

  test('every data-i18n key exists', () => {
    const keys = [...html.matchAll(/data-i18n(?:-label)?="([^"]+)"/g)].map(([, key]) => key);
    expect(keys.length).toBeGreaterThan(20);
    expect(keys.filter((key) => !isMessageKey(key))).toEqual([]);
  });

  test('ships in Russian, matching the messages', () => {
    const ru = translator('ru');
    expect(html).toContain(`<title>${ru('meta.title')}</title>`);
    expect(html).toContain(ru('meta.description'));
  });
});
