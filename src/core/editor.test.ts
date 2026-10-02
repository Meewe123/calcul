import { describe, expect, test } from 'vitest';
import {
  EMPTY,
  MAX_DIGITS,
  MAX_TOKENS,
  fromSource,
  inputsExact,
  insertValue,
  isTrivial,
  openCount,
  press,
  toSource,
  trimIncomplete,
  type Expression,
  type Key,
} from './editor';

/** Types a sequence of keys. `"12+3"` presses 1, 2, +, 3; `⌫` is backspace, `p` is `()`. */
function type(keys: string, from: Expression = EMPTY): Expression {
  let tokens = from;
  for (const char of keys) {
    const key = (char === '⌫' ? 'backspace' : char === 'p' ? '()' : char) as Key;
    tokens = press(tokens, key);
  }
  return tokens;
}

const typed = (keys: string): string => toSource(type(keys));

describe('numbers', () => {
  test.each([
    ['123', '123'],
    ['007', '7'],
    ['0', '0'],
    ['00', '0'],
    ['.5', '0.5'],
    ['1.2.3', '1.23'],
    ['5.', '5.'],
    ['5.+', '5+'],
    ['5.%', '5%'],
    ['5.)', '5.'],
  ])('%j → %j', (keys, expected) => {
    expect(typed(keys)).toBe(expected);
  });

  test(`stops at ${MAX_DIGITS} digits`, () => {
    expect(typed('1'.repeat(MAX_DIGITS + 5))).toBe('1'.repeat(MAX_DIGITS));
    expect(typed('0.' + '1'.repeat(MAX_DIGITS + 5))).toBe('0.' + '1'.repeat(MAX_DIGITS - 1));
  });
});

describe('operators', () => {
  test.each([
    ['+', ''],
    ['*', ''],
    ['-5', '-5'],
    ['--5', '-5'],
    ['2+*3', '2*3'],
    ['2++3', '2+3'],
    ['2+-3', '2-3'],
    ['2*-3', '2*-3'],
    ['2/-3', '2/-3'],
    ['2*--3', '2*-3'],
    ['2*-+3', '2+3'],
    ['(-*', '('],
    ['-+', ''],
  ])('%j → %j', (keys, expected) => {
    expect(typed(keys)).toBe(expected);
  });
});

describe('parentheses', () => {
  test.each([
    ['(2+3)', '(2+3)'],
    [')', ''],
    ['(2+)', '(2+'],
    ['2(3)', '2*(3)'],
    ['(2)(3)', '(2)*(3)'],
    ['(2)3', '(2)*3'],
    ['(2).5', '(2)*0.5'],
    ['5%3', '5%*3'],
    ['p2+3p', '(2+3)'],
    ['2p3pp', '2*(3)*('],
    ['((1p', '((1)'],
  ])('%j → %j', (keys, expected) => {
    expect(typed(keys)).toBe(expected);
  });

  test('counts what is still open', () => {
    expect(openCount(type('((1)+(2'))).toBe(2);
    expect(openCount(type('(1)'))).toBe(0);
  });
});

describe('percent', () => {
  test.each([
    ['%', ''],
    ['50%', '50%'],
    ['50%%', '50%'],
    ['2+%', '2+'],
    ['(10)%', '(10)%'],
  ])('%j → %j', (keys, expected) => {
    expect(typed(keys)).toBe(expected);
  });
});

describe('backspace', () => {
  test.each([
    ['⌫', ''],
    ['123⌫', '12'],
    ['1⌫', ''],
    ['0.⌫', '0'],
    ['2+⌫', '2'],
    ['2(⌫', '2*'],
    ['2(⌫⌫', '2'],
  ])('%j → %j', (keys, expected) => {
    expect(typed(keys)).toBe(expected);
  });

  test('removes a reused value as a whole', () => {
    const tokens = insertValue(type('2+'), '1.5e+40', true);
    expect(toSource(press(tokens, 'backspace'))).toBe('2+');
  });
});

describe('insertValue', () => {
  test('appends after an operator, multiplies after a value', () => {
    expect(toSource(insertValue(type('2+'), '42', true))).toBe('2+42');
    expect(toSource(insertValue(type('2'), '42', true))).toBe('2*42');
    expect(toSource(insertValue(type('2.'), '42', true))).toBe('2*42');
    expect(toSource(insertValue(EMPTY, '-7', true))).toBe('-7');
  });

  test('digits after a value start a new factor', () => {
    expect(toSource(type('5', insertValue(EMPTY, '42', true)))).toBe('42*5');
  });

  test('tracks whether reused values were exact', () => {
    expect(inputsExact(insertValue(type('1+'), '0.3', true))).toBe(true);
    expect(inputsExact(insertValue(type('1+'), '0.3', false))).toBe(false);
  });
});

describe('limits', () => {
  test(`ignores keys past ${MAX_TOKENS} tokens`, () => {
    const long = type('1+'.repeat(MAX_TOKENS));
    expect(long.length).toBeLessThanOrEqual(MAX_TOKENS);
    expect(type('+', long)).toBe(long);
  });

  test('a rejected key returns the very same array', () => {
    const tokens = type('2+');
    expect(press(tokens, '+')).toBe(tokens);
    expect(press(tokens, ')')).toBe(tokens);
    expect(press(type('0'), '0')).toEqual(type('0'));
  });
});

describe('fromSource', () => {
  test('rebuilds editable tokens from canonical source', () => {
    for (const source of ['0.1+0.2', '-5*(2+3)%', '2*-3', '(1)']) {
      expect(toSource(fromSource(source))).toBe(source);
    }
    expect(fromSource('-1')).toEqual([{ kind: 'minus' }, { kind: 'number', text: '1' }]);
  });

  test('turns long or scientific numbers into values', () => {
    expect(fromSource('1.5e+40')[0]).toEqual({ kind: 'value', text: '1.5e+40', exact: true });
    expect(fromSource('1'.repeat(40))[0]?.kind).toBe('value');
  });
});

describe('helpers', () => {
  test('isTrivial: a lone number with an optional sign', () => {
    expect(isTrivial(type('5'))).toBe(true);
    expect(isTrivial(type('-5'))).toBe(true);
    expect(isTrivial(type('5+1'))).toBe(false);
    expect(isTrivial(type('5%'))).toBe(false);
    expect(isTrivial(type('(5'))).toBe(false);
    expect(isTrivial(EMPTY)).toBe(false);
  });

  test('trimIncomplete drops dangling operators and open parentheses', () => {
    expect(toSource(trimIncomplete(type('2+3*(')))).toBe('2+3');
    expect(toSource(trimIncomplete(type('2*-')))).toBe('2');
    const done = type('2+3');
    expect(trimIncomplete(done)).toBe(done);
  });
});
