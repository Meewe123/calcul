import { describe, expect, test } from 'vitest';
import { commandForKey } from './keyboard';

const key = (
  k: string,
  modifiers: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {},
) => commandForKey({ key: k, ctrlKey: false, metaKey: false, altKey: false, ...modifiers });

describe('commandForKey', () => {
  test.each(['0', '5', '9', '+', '-', '*', '/', '%', '(', ')'])('types %j', (k) => {
    expect(key(k)).toEqual({ type: 'press', key: k });
  });

  test('both decimal separators and typographic operators', () => {
    expect(key(',')).toEqual({ type: 'press', key: '.' });
    expect(key('.')).toEqual({ type: 'press', key: '.' });
    expect(key('×')).toEqual({ type: 'press', key: '*' });
    expect(key('÷')).toEqual({ type: 'press', key: '/' });
    expect(key('−')).toEqual({ type: 'press', key: '-' });
  });

  test('editing and evaluation keys', () => {
    expect(key('Enter')).toEqual({ type: 'evaluate' });
    expect(key('=')).toEqual({ type: 'evaluate' });
    expect(key('Backspace')).toEqual({ type: 'press', key: 'backspace' });
    expect(key('Escape')).toEqual({ type: 'clear' });
    expect(key('Delete')).toEqual({ type: 'clear' });
  });

  test('leaves browser shortcuts alone (the zoom bug from the audit)', () => {
    expect(key('-', { ctrlKey: true })).toBeNull();
    expect(key('=', { ctrlKey: true })).toBeNull();
    expect(key('1', { metaKey: true })).toBeNull();
    expect(key('5', { altKey: true })).toBeNull();
  });

  test('ignores everything else', () => {
    expect(key('a')).toBeNull();
    expect(key(' ')).toBeNull();
    expect(key('Tab')).toBeNull();
    expect(key('ArrowLeft')).toBeNull();
  });
});
