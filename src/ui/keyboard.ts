/** Maps physical keys to calculator commands. Kept free of DOM types so it can be unit-tested. */
import type { Key } from '../core/editor';

export type Command =
  | { readonly type: 'press'; readonly key: Key }
  | { readonly type: 'evaluate' }
  | { readonly type: 'clear' };

export interface KeyInput {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
}

const PRESS: Readonly<Record<string, Key>> = {
  '0': '0',
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '.': '.',
  ',': '.',
  '+': '+',
  '-': '-',
  '−': '-',
  '*': '*',
  '×': '*',
  '/': '/',
  '÷': '/',
  '%': '%',
  '(': '(',
  ')': ')',
  Backspace: 'backspace',
};

/**
 * Returns the command for a key, or null to leave the key to the browser.
 * Anything with Ctrl, ⌘ or Alt belongs to the browser: zoom, tabs, copy.
 */
export function commandForKey(input: KeyInput): Command | null {
  if (input.ctrlKey || input.metaKey || input.altKey) return null;
  const key = PRESS[input.key];
  if (key) return { type: 'press', key };
  if (input.key === 'Enter' || input.key === '=') return { type: 'evaluate' };
  if (input.key === 'Escape' || input.key === 'Delete' || input.key === 'Clear') {
    return { type: 'clear' };
  }
  return null;
}
