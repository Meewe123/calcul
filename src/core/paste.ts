/**
 * Reads pasted text as a sequence of key presses, so a pasted expression
 * goes through exactly the same rules as a typed one.
 */
import type { Key } from './editor';
import type { Locale } from './format';

/** Longer text is almost certainly not an expression. */
export const MAX_PASTE_LENGTH = 500;

export type PasteResult =
  | { readonly ok: true; readonly keys: readonly Key[] }
  | { readonly ok: false; readonly reason: 'tooLong' | 'empty' }
  | { readonly ok: false; readonly reason: 'unexpectedCharacter'; readonly character: string }
  | { readonly ok: false; readonly reason: 'ambiguousNumber'; readonly number: string };

const SYMBOL_KEYS: Readonly<Record<string, Key>> = {
  '+': '+',
  '-': '-',
  '−': '-', // − minus sign
  '–': '-', // – en dash, common in text editors
  '*': '*',
  '×': '*', // ×
  '·': '*', // · middle dot
  x: '*',
  X: '*',
  '/': '/',
  '÷': '/', // ÷
  ':': '/', // division in Russian school notation
  '%': '%',
  '(': '(',
  ')': ')',
};

/** Spaces of all kinds, including the ones used for digit grouping. */
const SPACE = /[\s\u00a0\u2009\u202f]/;

/**
 * In Russian, both `,` and `.` are read as the decimal separator. In English,
 * `.` is decimal and `,` groups digits: `1,000.5`. A number with two decimal
 * separators is refused rather than guessed.
 */
export function readPaste(text: string, locale: Locale): PasteResult {
  if (text.length > MAX_PASTE_LENGTH) return { ok: false, reason: 'tooLong' };

  // Full-width digits and similar lookalikes become plain ASCII.
  const normalized = text.normalize('NFKC').trim().replace(/=+$/, '');
  const keys: Key[] = [];
  let number = '';
  let separators = 0;

  const endNumber = (): boolean => {
    const ok = separators <= 1;
    number = '';
    separators = 0;
    return ok;
  };

  for (const char of normalized) {
    if (char >= '0' && char <= '9') {
      keys.push(char as Key);
      number += char;
    } else if (char === '.' || (char === ',' && locale === 'ru')) {
      keys.push('.');
      number += char;
      separators += 1;
    } else if (char === ',' || SPACE.test(char)) {
      // Digit grouping or plain spacing: nothing to type.
    } else if (char in SYMBOL_KEYS) {
      const current = number;
      if (!endNumber()) return { ok: false, reason: 'ambiguousNumber', number: current };
      keys.push(SYMBOL_KEYS[char] ?? '+');
    } else {
      return { ok: false, reason: 'unexpectedCharacter', character: char };
    }
  }
  const current = number;
  if (!endNumber()) return { ok: false, reason: 'ambiguousNumber', number: current };
  if (keys.length === 0) return { ok: false, reason: 'empty' };
  return { ok: true, keys };
}
