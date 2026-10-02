import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import {
  PRECISION,
  ZERO,
  add,
  adjustedExponent,
  divide,
  equals,
  fromInteger,
  isNegative,
  isZero,
  multiply,
  negate,
  parseDecimal,
  percentOf,
  roundToSignificant,
  significantDigits,
  subtract,
  toCanonicalString,
  type Decimal,
} from './decimal';
import { CalcError } from './errors';

const d = parseDecimal;
const str = toCanonicalString;

describe('parseDecimal', () => {
  test.each([
    ['0', '0'],
    ['-0', '0'],
    ['007', '7'],
    ['12.', '12'],
    ['.5', '0.5'],
    ['-0.50', '-0.5'],
    ['1200', '1200'],
    ['1e3', '1000'],
    ['1.5E-3', '0.0015'],
    ['  42 ', '42'],
  ])('%j → %s', (input, expected) => {
    const value = d(input);
    expect(str(value)).toBe(expected);
    expect(value.exact).toBe(true);
  });

  test.each(['', '.', '-', 'abc', '1.2.3', '1e', '--1', '1,5'])('rejects %j', (input) => {
    expect(() => d(input)).toThrow(SyntaxError);
  });

  test('stores trailing zeros in the exponent', () => {
    expect(d('1200')).toEqual({ coef: 12n, exp: 2, exact: true });
    expect(d('0.0300')).toEqual({ coef: 3n, exp: -2, exact: true });
  });

  test('rounds input longer than PRECISION and marks it inexact', () => {
    const value = d('1.' + '1'.repeat(PRECISION) + '9');
    expect(significantDigits(value)).toBe(PRECISION);
    expect(value.exact).toBe(false);
  });

  test('handles absurd exponents without hanging', () => {
    expect(() => d('1e999999999')).toThrow(CalcError);
    expect(isZero(d('1e-999999999'))).toBe(true);
  });
});

describe('fromInteger', () => {
  test('accepts numbers and bigints', () => {
    expect(str(fromInteger(-42))).toBe('-42');
    expect(str(fromInteger(10n ** 30n))).toBe('1e+30');
  });

  test('refuses unsafe numbers', () => {
    expect(() => fromInteger(2 ** 60)).toThrow(RangeError);
    expect(() => fromInteger(0.5)).toThrow(RangeError);
  });
});

describe('arithmetic', () => {
  test('0.1 + 0.2 is exactly 0.3', () => {
    const sum = add(d('0.1'), d('0.2'));
    expect(equals(sum, d('0.3'))).toBe(true);
    expect(sum.exact).toBe(true);
  });

  test('long integers keep every digit (the bug from the audit)', () => {
    expect(str(add(d('123456789012345'), d('1')))).toBe('123456789012346');
    expect(str(multiply(d('999999999999999'), d('10')))).toBe('9999999999999990');
  });

  test('subtract to zero gives canonical zero', () => {
    const result = subtract(d('5.5'), d('5.50'));
    expect(result).toEqual(ZERO);
  });

  test('multiply keeps decimals exact', () => {
    expect(str(multiply(d('1.1'), d('1.1')))).toBe('1.21');
    expect(str(multiply(d('-0.5'), d('0.2')))).toBe('-0.1');
  });

  test('exact division stays exact', () => {
    const result = divide(d('10'), d('4'));
    expect(str(result)).toBe('2.5');
    expect(result.exact).toBe(true);
    expect(str(divide(d('1'), d('8')))).toBe('0.125');
    expect(str(divide(d('-6'), d('3')))).toBe('-2');
  });

  test('1 / 3 is rounded to PRECISION digits and marked inexact', () => {
    const result = divide(d('1'), d('3'));
    expect(str(result)).toBe('0.' + '3'.repeat(PRECISION));
    expect(result.exact).toBe(false);
  });

  test('2 / 3 rounds the last digit up', () => {
    expect(str(divide(d('2'), d('3')))).toBe('0.' + '6'.repeat(PRECISION - 1) + '7');
  });

  test('inexactness propagates through later operations', () => {
    const third = divide(d('1'), d('3'));
    const result = multiply(third, d('3'));
    expect(result.exact).toBe(false);
    expect(add(result, d('1')).exact).toBe(false);
  });

  test('division by zero throws a CalcError', () => {
    expect(() => divide(d('1'), ZERO)).toThrow(expect.objectContaining({ code: 'divisionByZero' }));
    expect(() => divide(ZERO, ZERO)).toThrow(CalcError);
  });

  test('zero divided by anything is zero', () => {
    expect(divide(ZERO, d('7'))).toEqual(ZERO);
  });

  test('overflow throws, underflow flushes to an inexact zero', () => {
    expect(() => multiply(d('1e9999'), d('10'))).toThrow(
      expect.objectContaining({ code: 'overflow' }),
    );
    const tiny = divide(d('1e-9999'), d('10'));
    expect(isZero(tiny)).toBe(true);
    expect(tiny.exact).toBe(false);
  });

  test('adding a value far below the last digit keeps the larger one, inexactly', () => {
    const result = add(d('1e100'), d('1'));
    expect(str(result)).toBe('1e+100');
    expect(result.exact).toBe(false);
    expect(str(add(d('-1'), d('1e60')))).toBe('1e+60');
  });

  test('negate and percentOf', () => {
    expect(str(negate(d('2.5')))).toBe('-2.5');
    expect(negate(ZERO)).toBe(ZERO);
    expect(isNegative(d('-1'))).toBe(true);
    expect(str(percentOf(d('50')))).toBe('0.5');
    expect(str(percentOf(d('-12.5')))).toBe('-0.125');
  });

  test('adjustedExponent', () => {
    expect(adjustedExponent(d('1234'))).toBe(3);
    expect(adjustedExponent(d('0.05'))).toBe(-2);
    expect(adjustedExponent(ZERO)).toBe(0);
  });
});

describe('roundToSignificant', () => {
  test.each([
    ['2.5', 1, '2'],
    ['3.5', 1, '4'],
    ['-2.5', 1, '-2'],
    ['2.51', 1, '3'],
    ['9.96', 2, '10'],
    ['123456', 3, '123000'],
    ['0.000123456', 2, '0.00012'],
  ])('%s to %i digits → %s', (input, digits, expected) => {
    const result = roundToSignificant(d(input), digits);
    expect(str(result)).toBe(expected);
    expect(result.exact).toBe(false);
  });

  test('leaves short values untouched', () => {
    const value = d('1.5');
    expect(roundToSignificant(value, 5)).toBe(value);
  });

  test('rejects nonsense digit counts', () => {
    expect(() => roundToSignificant(d('1'), 0)).toThrow(RangeError);
  });
});

describe('toCanonicalString', () => {
  test.each([
    ['1e25', '1e+25'],
    ['1.5e25', '1.5e+25'],
    ['-1.5e25', '-1.5e+25'],
    ['1e20', '100000000000000000000'],
    ['0.001', '0.001'],
    ['1e-30', '1e-30'],
    ['-1.25e-30', '-1.25e-30'],
    ['123.45', '123.45'],
  ])('%s → %s', (input, expected) => {
    expect(str(d(input))).toBe(expected);
  });
});

// Property-based tests: random inputs, checked against plain BigInt math.

/** Decimals small enough that +, −, × never need more than PRECISION digits. */
const smallDecimal = fc
  .record({
    coef: fc.bigInt({ min: -(10n ** 12n), max: 10n ** 12n }),
    exp: fc.integer({ min: -8, max: 8 }),
  })
  .map(({ coef, exp }) => parseDecimal(`${coef}e${exp}`));

const anyDecimal = fc
  .record({
    coef: fc.bigInt({ min: -(10n ** 40n), max: 10n ** 40n }),
    exp: fc.integer({ min: -60, max: 60 }),
  })
  .map(({ coef, exp }) => parseDecimal(`${coef}e${exp}`));

/** Exact rational value of a decimal: numerator / denominator. */
function toFraction(value: Decimal): { num: bigint; den: bigint } {
  return value.exp >= 0
    ? { num: value.coef * 10n ** BigInt(value.exp), den: 1n }
    : { num: value.coef, den: 10n ** BigInt(-value.exp) };
}

describe('properties', () => {
  test('integer +, −, × match BigInt exactly', () => {
    const integer = fc.bigInt({ min: -(10n ** 16n), max: 10n ** 16n });
    fc.assert(
      fc.property(integer, integer, (a, b) => {
        expect(str(add(fromInteger(a), fromInteger(b)))).toBe(String(a + b));
        expect(str(subtract(fromInteger(a), fromInteger(b)))).toBe(String(a - b));
        expect(equals(multiply(fromInteger(a), fromInteger(b)), fromInteger(a * b))).toBe(true);
      }),
    );
  });

  test('a + b − b = a, exactly', () => {
    fc.assert(
      fc.property(smallDecimal, smallDecimal, (a, b) => {
        const result = subtract(add(a, b), b);
        expect(equals(result, a)).toBe(true);
        expect(result.exact).toBe(true);
      }),
    );
  });

  test('addition and multiplication commute', () => {
    fc.assert(
      fc.property(anyDecimal, anyDecimal, (a, b) => {
        expect(equals(add(a, b), add(b, a))).toBe(true);
        expect(equals(multiply(a, b), multiply(b, a))).toBe(true);
      }),
    );
  });

  test('(a × b) / b = a for non-zero b', () => {
    fc.assert(
      fc.property(smallDecimal, smallDecimal, (a, b) => {
        fc.pre(!isZero(b));
        const result = divide(multiply(a, b), b);
        expect(equals(result, a)).toBe(true);
        expect(result.exact).toBe(true);
      }),
    );
  });

  test('division is correctly rounded: |a − q·b| ≤ ½ ulp(q) · |b|', () => {
    fc.assert(
      fc.property(anyDecimal, anyDecimal, (a, b) => {
        fc.pre(!isZero(b));
        const q = divide(a, b);
        const fa = toFraction(a);
        const fb = toFraction(b);
        const fq = toFraction(q);
        // a − q·b as one fraction: (na·dq·db − nq·nb·da) / (da·dq·db)
        const errorNum = fa.num * fq.den * fb.den - fq.num * fb.num * fa.den;
        const errorDen = fa.den * fq.den * fb.den;
        const ulpExp = adjustedExponent(q) - PRECISION + 1;
        const absErr = errorNum < 0n ? -errorNum : errorNum;
        const absB = fb.num < 0n ? -fb.num : fb.num;
        // 2·|err|/errDen ≤ 10^ulpExp · |nb|/db, multiplied out to stay in integers
        const left = 2n * absErr * fb.den;
        const right = absB * errorDen;
        if (ulpExp >= 0) expect(left <= 10n ** BigInt(ulpExp) * right).toBe(true);
        else expect(left * 10n ** BigInt(-ulpExp) <= right).toBe(true);
        expect(q.exact).toBe(a.exact && b.exact && errorNum === 0n);
      }),
    );
  });

  test('canonical string round-trips', () => {
    fc.assert(
      fc.property(anyDecimal, (a) => {
        expect(equals(parseDecimal(str(a)), a)).toBe(true);
      }),
    );
  });

  test('values never carry more than PRECISION digits', () => {
    fc.assert(
      fc.property(anyDecimal, anyDecimal, (a, b) => {
        for (const value of [add(a, b), multiply(a, b), isZero(b) ? a : divide(a, b)]) {
          expect(significantDigits(value)).toBeLessThanOrEqual(PRECISION);
        }
      }),
    );
  });
});
