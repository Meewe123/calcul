import { describe, expect, test } from 'vitest';
import { divide, parseDecimal } from './decimal';
import {
  expressionToText,
  formatDecimal,
  formatExpression,
  numberToClipboard,
  numberToText,
  type Locale,
} from './format';

/** Narrow no-break space, the Russian digit group separator. */
const NB = String.fromCharCode(0x202f);

const text = (value: string, locale: Locale, digits?: number): string =>
  numberToText(formatDecimal(parseDecimal(value), locale, digits), locale);

describe('formatDecimal', () => {
  test.each<[string, string, string]>([
    ['0', '0', '0'],
    ['5', '5', '5'],
    ['-5', '−5', '−5'],
    ['1000', `1${NB}000`, '1,000'],
    ['1234567.5', `1${NB}234${NB}567,5`, '1,234,567.5'],
    ['0.000001', '0,000001', '0.000001'],
    ['0.0000001', '1 × 10^-7', '1 × 10^-7'],
    ['1e16', '1 × 10^16', '1 × 10^16'],
    ['9999999999999999', `9${NB}999${NB}999${NB}999${NB}999${NB}999`, '9,999,999,999,999,999'],
    ['-1.25e40', '−1,25 × 10^40', '−1.25 × 10^40'],
  ])('%s → ru %j, en %j', (value, ru, en) => {
    expect(text(value, 'ru')).toBe(ru);
    expect(text(value, 'en')).toBe(en);
  });

  test('rounds to the display digits and says so', () => {
    const third = formatDecimal(divide(parseDecimal('1'), parseDecimal('3')), 'en');
    expect(third).toEqual({
      negative: false,
      integer: '0',
      fraction: '3'.repeat(16),
      exponent: null,
      rounded: true,
    });
  });

  test('long exact integers switch to scientific form, marked as rounded', () => {
    const result = formatDecimal(parseDecimal('12345678901234567890'), 'en');
    expect(numberToText(result, 'en')).toBe('1.234567890123457 × 10^19');
    expect(result.rounded).toBe(true);
  });

  test('exact short values are not marked as rounded', () => {
    expect(formatDecimal(parseDecimal('0.3'), 'ru').rounded).toBe(false);
  });

  test('custom digit count', () => {
    expect(text('3.14159', 'en', 3)).toBe('3.14');
  });
});

describe('numberToClipboard', () => {
  test('drops grouping and uses E notation', () => {
    const big = formatDecimal(parseDecimal('1234567.5'), 'ru');
    expect(numberToClipboard(big, 'ru')).toBe('1234567,5');
    expect(numberToClipboard(formatDecimal(parseDecimal('1234567.5'), 'en'), 'en')).toBe(
      '1234567.5',
    );
    expect(numberToClipboard(formatDecimal(parseDecimal('-1.5e40'), 'en'), 'en')).toBe('-1.5E40');
  });
});

describe('formatExpression', () => {
  test('uses typographic operators, tells unary minus from binary', () => {
    const parts = formatExpression('-12+3*(4-1)%/-2', 'en');
    expect(parts.map((p) => [p.kind, 'text' in p ? p.text : '·'])).toEqual([
      ['sign', '−'],
      ['number', '12'],
      ['operator', '+'],
      ['number', '3'],
      ['operator', '×'],
      ['paren', '('],
      ['number', '4'],
      ['operator', '−'],
      ['number', '1'],
      ['paren', ')'],
      ['percent', '%'],
      ['operator', '÷'],
      ['sign', '−'],
      ['number', '2'],
    ]);
  });

  test('keeps numbers as typed, including a trailing separator', () => {
    const parts = formatExpression('1234.50+12.', 'ru');
    expect(expressionToText(parts, 'ru')).toBe(`1${NB}234,50 + 12,`);
  });

  test('shows long reused values rounded, with an ellipsis', () => {
    const third = '0.' + '3'.repeat(34);
    const parts = formatExpression(`${third}*3`, 'en');
    expect(parts[0]).toMatchObject({ kind: 'value', truncated: true });
    expect(expressionToText(parts, 'en')).toBe('0.333333333333… × 3');
  });

  test('shows scientific values in full when short', () => {
    expect(expressionToText(formatExpression('1.5e+40+1', 'en'), 'en')).toBe('1.5 × 10^40 + 1');
  });

  test('spans point back into the source', () => {
    const parts = formatExpression('12+3', 'en');
    expect(parts.map((p) => p.span)).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 3 },
      { start: 3, end: 4 },
    ]);
  });
});
