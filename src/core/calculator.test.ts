import { describe, expect, test } from 'vitest';
import {
  MAX_TAPE_ENTRIES,
  createState,
  expressionOf,
  pendingParens,
  preview,
  reduce,
  type Action,
  type State,
  type TapeEntry,
} from './calculator';
import { toCanonicalString } from './decimal';
import { toSource, type Key } from './editor';

/** Plays keys: digits and operators press, `=` evaluates, `C` clears, `⌫` erases. */
function play(keys: string, from: State = createState()): State {
  let state = from;
  for (const char of keys) {
    const action: Action =
      char === '='
        ? { type: 'evaluate' }
        : char === 'C'
          ? { type: 'clear' }
          : { type: 'press', key: (char === '⌫' ? 'backspace' : char) as Key };
    state = reduce(state, action);
  }
  return state;
}

function resultOf(state: State): string {
  if (state.mode !== 'result') throw new Error(`Expected a result, got ${state.mode}`);
  return toCanonicalString(state.value);
}

const shown = (state: State): string => toSource(expressionOf(state));

describe('evaluate', () => {
  test('prints the calculation on the tape', () => {
    const state = play('2+3*4=');
    expect(resultOf(state)).toBe('14');
    expect(state.tape).toEqual([{ id: 1, source: '2+3*4', result: '14', exact: true }]);
  });

  test('writes out auto-closed parentheses on the tape', () => {
    const state = play('2*(3+4=');
    expect(resultOf(state)).toBe('14');
    expect(state.tape[0]?.source).toBe('2*(3+4)');
  });

  test('a lone number is shown as a result but not printed', () => {
    const state = play('5=');
    expect(resultOf(state)).toBe('5');
    expect(state.tape).toEqual([]);
  });

  test('= on an empty expression does nothing', () => {
    const state = createState();
    expect(reduce(state, { type: 'evaluate' })).toEqual(state);
  });

  test('= again on a result does nothing', () => {
    const state = play('1+1=');
    expect(reduce(state, { type: 'evaluate' })).toBe(state);
  });

  test('marks rounded results', () => {
    expect(play('1/3=').tape[0]?.exact).toBe(false);
  });
});

describe('errors keep the expression', () => {
  test('division by zero can be fixed with backspace', () => {
    const failed = play('10/0=');
    expect(failed.mode).toBe('error');
    if (failed.mode === 'error') expect(failed.error.code).toBe('divisionByZero');
    expect(failed.tape).toEqual([]);

    const fixed = play('⌫2=', failed);
    expect(resultOf(fixed)).toBe('5');
  });

  test('an unfinished expression is an error, not a guess', () => {
    const state = play('12+=');
    expect(state.mode === 'error' && state.error.code).toBe('incomplete');
    expect(shown(state)).toBe('12+');
  });

  test('clear leaves the error', () => {
    expect(play('1/0=C')).toEqual(createState());
  });
});

describe('after a result', () => {
  test('an operator continues from the result', () => {
    const state = play('2+3=*2');
    expect(state.mode).toBe('edit');
    expect(shown(state)).toBe('5*2');
    expect(resultOf(play('=', state))).toBe('10');
  });

  test('a digit starts over', () => {
    expect(shown(play('2+3=7'))).toBe('7');
    expect(shown(play('2+3=.'))).toBe('0.');
    expect(shown(play('2+3=('))).toBe('(');
  });

  test('backspace clears the result', () => {
    expect(play('2+3=⌫')).toEqual({ ...createState(), tape: play('2+3=').tape });
  });

  test('a rounded result stays approximate when reused', () => {
    const state = play('1/3=*3=');
    expect(state.tape[1]?.exact).toBe(false);
  });
});

describe('insert from the tape', () => {
  test('adds the value to the expression', () => {
    const state = reduce(play('100+'), { type: 'insert', value: '42', exact: true });
    expect(shown(state)).toBe('100+42');
  });

  test('replaces a shown result', () => {
    const state = reduce(play('2+2='), { type: 'insert', value: '42', exact: true });
    expect(shown(state)).toBe('42');
  });

  test('a rounded value makes the preview approximate', () => {
    const third = '0.' + '3'.repeat(34);
    const state = reduce(play('1+'), { type: 'insert', value: third, exact: false });
    expect(preview(state)?.exact).toBe(false);
  });
});

describe('run', () => {
  test('evaluates a whole expression at once (the examples)', () => {
    const state = reduce(play('9'), { type: 'run', source: '0.1+0.2' });
    expect(resultOf(state)).toBe('0.3');
    expect(state.tape).toHaveLength(1);
  });
});

describe('preview', () => {
  test.each([
    ['', null],
    ['5', null],
    ['-5', null],
    ['2+3', '5'],
    ['2+3*', '5'],
    ['2*(3+4', '14'],
    ['200+10%', '220'],
    ['1/0', null],
  ])('%j → %j', (keys, expected) => {
    const value = preview(play(keys));
    expect(value ? toCanonicalString(value) : null).toBe(expected);
  });

  test('is empty outside editing', () => {
    expect(preview(play('2+3='))).toBeNull();
  });
});

describe('tape', () => {
  test('ids keep growing', () => {
    const state = play('1+1=2+2=3+3=');
    expect(state.tape.map((e) => e.id)).toEqual([1, 2, 3]);
  });

  test(`keeps the last ${MAX_TAPE_ENTRIES} entries`, () => {
    const full: TapeEntry[] = Array.from({ length: MAX_TAPE_ENTRIES }, (_, i) => ({
      id: i + 1,
      source: '1+1',
      result: '2',
      exact: true,
    }));
    const state = play('2+2=', createState(full));
    expect(state.tape).toHaveLength(MAX_TAPE_ENTRIES);
    expect(state.tape[0]?.id).toBe(2);
    expect(state.tape.at(-1)).toMatchObject({ id: MAX_TAPE_ENTRIES + 1, result: '4' });
  });

  test('setTape replaces it without touching the expression', () => {
    const state = reduce(play('12+'), { type: 'setTape', tape: [] });
    expect(shown(state)).toBe('12+');
  });
});

describe('display helpers', () => {
  test('pending parentheses', () => {
    expect(pendingParens(play('((1'))).toBe(2);
    expect(pendingParens(play('(1='))).toBe(0);
  });
});
