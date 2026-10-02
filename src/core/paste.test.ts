import { describe, expect, test } from 'vitest';
import { EMPTY, press, toSource } from './editor';
import { MAX_PASTE_LENGTH, readPaste } from './paste';
import type { Locale } from './format';

function pasted(text: string, locale: Locale): string {
  const result = readPaste(text, locale);
  if (!result.ok) throw new Error(result.reason);
  return toSource(result.keys.reduce(press, EMPTY));
}

describe('readPaste', () => {
  test.each<[string, Locale, string]>([
    ['2 + 2', 'en', '2+2'],
    ['2+2=', 'en', '2+2'],
    ['12 × 3 − 4 ÷ 2', 'ru', '12*3-4/2'],
    ['10 – 3', 'ru', '10-3'],
    ['2x3', 'en', '2*3'],
    ['8 : 2', 'ru', '8/2'],
    ['1 000,5 + 1', 'ru', '1000.5+1'],
    ['1,000.5 + 1', 'en', '1000.5+1'],
    ['0.5', 'ru', '0.5'],
    ['２＋３', 'en', '2+3'],
    ['(1 + 2)%', 'en', '(1+2)%'],
  ])('%j (%s) → %j', (text, locale, expected) => {
    expect(pasted(text, locale)).toBe(expected);
  });

  test('names the character it cannot read', () => {
    expect(readPaste('2 + abc', 'en')).toEqual({
      ok: false,
      reason: 'unexpectedCharacter',
      character: 'a',
    });
  });

  test('refuses numbers with two decimal separators instead of guessing', () => {
    expect(readPaste('1.000,5', 'ru')).toMatchObject({ ok: false, reason: 'ambiguousNumber' });
    expect(readPaste('1,000.5 + 1', 'ru')).toMatchObject({
      ok: false,
      reason: 'ambiguousNumber',
      number: '1,000.5',
    });
  });

  test('refuses empty and oversized text', () => {
    expect(readPaste('   ', 'en')).toEqual({ ok: false, reason: 'empty' });
    expect(readPaste('1'.repeat(MAX_PASTE_LENGTH + 1), 'en')).toEqual({
      ok: false,
      reason: 'tooLong',
    });
  });
});
