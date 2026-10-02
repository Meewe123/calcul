import { describe, expect, test } from 'vitest';
import { PRECISION, toCanonicalString } from './decimal';
import { CalcError, isCalcError, type CalcErrorCode } from './errors';
import { MAX_SOURCE_LENGTH, calculate } from './evaluate';
import { tokenize } from './lexer';
import { MAX_DEPTH, parse } from './parser';

const calc = (source: string, autoClose = false): string =>
  toCanonicalString(calculate(source, { autoClose }));

function errorOf(fn: () => unknown): CalcError {
  try {
    fn();
  } catch (error) {
    if (isCalcError(error)) return error;
    throw error;
  }
  throw new Error('Expected a CalcError');
}

const codeOf = (source: string, autoClose = false): CalcErrorCode =>
  errorOf(() => calculate(source, { autoClose })).code;

describe('tokenize', () => {
  test('splits numbers, operators, percent and parentheses with spans', () => {
    expect(tokenize('12.5+(3)%')).toEqual([
      { type: 'number', text: '12.5', span: { start: 0, end: 4 } },
      { type: 'operator', op: '+', span: { start: 4, end: 5 } },
      { type: 'lparen', span: { start: 5, end: 6 } },
      { type: 'number', text: '3', span: { start: 6, end: 7 } },
      { type: 'rparen', span: { start: 7, end: 8 } },
      { type: 'percent', span: { start: 8, end: 9 } },
    ]);
  });

  test('accepts typographic operators and skips whitespace', () => {
    const ops = tokenize('1 × 2 ÷ 3 − 4').flatMap((t) => (t.type === 'operator' ? [t.op] : []));
    expect(ops).toEqual(['*', '/', '-']);
  });

  test('reads scientific notation produced by toCanonicalString', () => {
    expect(tokenize('1.5e+40*2e-3').map((t) => (t.type === 'number' ? t.text : '·'))).toEqual([
      '1.5e+40',
      '·',
      '2e-3',
    ]);
  });

  test.each([
    ['2 & 3', 2],
    ['.', 0],
    ['1e+', 1],
    ['12,5', 2],
  ])('reports the position of a bad character in %j', (source, start) => {
    expect(errorOf(() => tokenize(source))).toMatchObject({
      code: 'unexpectedCharacter',
      span: { start },
    });
  });
});

describe('precedence and associativity', () => {
  test.each([
    ['2 + 3 × 4', '14'],
    ['(2 + 3) × 4', '20'],
    ['8 − 3 − 2', '3'],
    ['64 ÷ 4 ÷ 2', '8'],
    ['2 × 3 + 4 × 5', '26'],
    ['10 − 2 × 3', '4'],
    ['-2 × 3', '-6'],
    ['3 × -2', '-6'],
    ['--5', '5'],
    ['-(2 + 3)', '-5'],
    ['((((7))))', '7'],
    ['0.1 + 0.2', '0.3'],
    ['1 ÷ 4', '0.25'],
  ])('%s = %s', (source, expected) => {
    expect(calc(source)).toBe(expected);
  });
});

describe('percent', () => {
  test.each([
    ['10%', '0.1'],
    ['200 + 10%', '220'],
    ['200 − 10%', '180'],
    ['200 + -10%', '180'],
    ['200 × 10%', '20'],
    ['200 ÷ 10%', '2000'],
    ['200 + (10%)', '200.1'],
    ['200 + (10)%', '220'],
    ['1200 − 15%', '1020'],
    ['(100 + 100) + 50%', '300'],
    ['50%%', '0.005'],
    ['100 + 10% × 2', '100.2'],
  ])('%s = %s', (source, expected) => {
    expect(calc(source)).toBe(expected);
  });
});

describe('auto-closing parentheses', () => {
  test('closes what is left open when asked', () => {
    expect(calc('2 × (3 + 4', true)).toBe('14');
    expect(calc('((1 + 1', true)).toBe('2');
    expect(parse(tokenize('((1'), { autoClose: true }).missingParens).toBe(2);
  });

  test('refuses open parentheses by default and points at them', () => {
    expect(errorOf(() => calculate('1 + (2'))).toMatchObject({
      code: 'unclosedParen',
      span: { start: 4, end: 5 },
    });
  });
});

describe('errors', () => {
  test.each<[string, CalcErrorCode]>([
    ['', 'empty'],
    ['   ', 'empty'],
    ['2 +', 'incomplete'],
    ['(', 'incomplete'],
    ['2 + × 3', 'unexpectedToken'],
    ['2 3', 'unexpectedToken'],
    [')', 'unexpectedToken'],
    ['2)', 'unexpectedToken'],
    ['%5', 'unexpectedToken'],
    ['()', 'unexpectedToken'],
    ['+5', 'unexpectedToken'],
    ['1 ÷ 0', 'divisionByZero'],
    ['1 ÷ (2 − 2)', 'divisionByZero'],
    ['1e9999 × 10', 'overflow'],
  ])('%j → %s', (source, code) => {
    expect(codeOf(source)).toBe(code);
  });

  test('division by zero points at the divisor', () => {
    expect(errorOf(() => calculate('7 ÷ (3 − 3)')).span).toEqual({ start: 4, end: 11 });
  });

  test('an incomplete expression points at its end', () => {
    expect(errorOf(() => calculate('12 +')).span).toEqual({ start: 4, end: 4 });
  });

  test('deep nesting is refused instead of overflowing the stack', () => {
    expect(codeOf('('.repeat(MAX_DEPTH + 1) + '1', true)).toBe('tooComplex');
    expect(codeOf('-'.repeat(MAX_DEPTH + 1) + '1')).toBe('tooComplex');
    expect(calc('('.repeat(MAX_DEPTH) + '1', true)).toBe('1');
  });

  test('very long input is refused up front', () => {
    expect(codeOf('1+'.repeat(MAX_SOURCE_LENGTH))).toBe('tooComplex');
  });
});

describe('exactness', () => {
  test('rounded results say so', () => {
    expect(calculate('1 ÷ 3').exact).toBe(false);
    expect(calculate('1 ÷ 3 × 3').exact).toBe(false);
    expect(calculate('1 ÷ 4').exact).toBe(true);
  });

  test('1 ÷ 3 × 3 is 0.99…9, not a silent 1', () => {
    expect(calc('1 ÷ 3 × 3')).toBe('0.' + '9'.repeat(PRECISION));
  });
});
