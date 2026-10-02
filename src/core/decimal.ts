/**
 * Exact decimal numbers built on BigInt.
 *
 * A value is `coef × 10^exp`. Addition, subtraction and multiplication are
 * exact as long as the result fits into PRECISION significant digits; the
 * rest (division, very long products) is rounded half to even, the way
 * IEEE 754 decimal128 does it. A value remembers whether rounding ever
 * happened on the way to it, so the UI can honestly show `≈` instead of `=`.
 */
import { CalcError } from './errors';

/** Significant digits kept after every operation. Same as decimal128. */
export const PRECISION = 34;

/** Largest adjusted exponent (the power of ten of the first digit). */
export const MAX_EXPONENT = 9999;

export interface Decimal {
  /** Signed coefficient without trailing zeros. Zero is always `0n`. */
  readonly coef: bigint;
  /** Power of ten the coefficient is multiplied by. Zero always has `0`. */
  readonly exp: number;
  /** False if the value was rounded at any step that produced it. */
  readonly exact: boolean;
}

export const ZERO: Decimal = Object.freeze({ coef: 0n, exp: 0, exact: true });

const NUMBER_PATTERN = /^(-)?(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i;

/**
 * Parses a plain decimal string: `12`, `-0.5`, `.5`, `12.`, `1.5e-20`.
 * Digits past PRECISION are rounded and the result is marked inexact.
 */
export function parseDecimal(text: string): Decimal {
  const match = NUMBER_PATTERN.exec(text.trim());
  const intPart = match?.[2] ?? '';
  const fracPart = match?.[3] ?? '';
  if (!match || intPart.length + fracPart.length === 0) {
    throw new SyntaxError(`Not a decimal number: "${text}"`);
  }
  const exponentPart = match[4] ?? '0';
  // Exponents far outside the supported range would only overflow later;
  // clamping keeps Number() exact and the error message the same.
  const exponent = Math.max(Math.min(Number(exponentPart), 10 * MAX_EXPONENT), -10 * MAX_EXPONENT);
  const coef = BigInt(intPart + fracPart || '0');
  return normalize(match[1] ? -coef : coef, exponent - fracPart.length, true);
}

export function fromInteger(value: number | bigint): Decimal {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new RangeError(`Not a safe integer: ${value}`);
  }
  return normalize(BigInt(value), 0, true);
}

export function isZero(value: Decimal): boolean {
  return value.coef === 0n;
}

export function isNegative(value: Decimal): boolean {
  return value.coef < 0n;
}

/** Numeric equality. Exactness is ignored: it describes history, not value. */
export function equals(a: Decimal, b: Decimal): boolean {
  return a.coef === b.coef && a.exp === b.exp;
}

export function negate(value: Decimal): Decimal {
  return value.coef === 0n ? value : { coef: -value.coef, exp: value.exp, exact: value.exact };
}

export function add(a: Decimal, b: Decimal): Decimal {
  const exact = a.exact && b.exact;
  if (a.coef === 0n) return withExactness(b, exact);
  if (b.coef === 0n) return withExactness(a, exact);

  // When one operand is far below the last kept digit of the other, it can
  // only affect rounding, and the rounding always goes back to the larger
  // operand. Skipping the alignment avoids building huge BigInts.
  const gap = adjustedExponent(a) - adjustedExponent(b);
  if (gap > PRECISION + 2) return withExactness(a, false);
  if (gap < -(PRECISION + 2)) return withExactness(b, false);

  const exp = Math.min(a.exp, b.exp);
  const coef = a.coef * pow10(a.exp - exp) + b.coef * pow10(b.exp - exp);
  return normalize(coef, exp, exact);
}

export function subtract(a: Decimal, b: Decimal): Decimal {
  return add(a, negate(b));
}

export function multiply(a: Decimal, b: Decimal): Decimal {
  return normalize(a.coef * b.coef, a.exp + b.exp, a.exact && b.exact);
}

export function divide(a: Decimal, b: Decimal): Decimal {
  if (b.coef === 0n) throw new CalcError('divisionByZero');
  const exact = a.exact && b.exact;
  if (a.coef === 0n) return withExactness(ZERO, exact);

  // Scale the dividend so the integer quotient has at least PRECISION + 1
  // digits; the remainder then only decides the direction of rounding.
  const shift = Math.max(0, PRECISION + 1 - (digitCount(a.coef) - digitCount(b.coef)));
  const dividend = abs(a.coef) * pow10(shift);
  const divisor = abs(b.coef);
  const quotient = dividend / divisor;
  const remainder = dividend % divisor;
  const negative = a.coef < 0n !== b.coef < 0n;
  return normalize(negative ? -quotient : quotient, a.exp - b.exp - shift, exact, remainder !== 0n);
}

/** Divides by 100. Exact, because it only moves the decimal point. */
export function percentOf(value: Decimal): Decimal {
  return normalize(value.coef, value.exp - 2, value.exact);
}

/** Power of ten of the first significant digit: 1234 → 3, 0.05 → -2. */
export function adjustedExponent(value: Decimal): number {
  return value.coef === 0n ? 0 : value.exp + digitCount(value.coef) - 1;
}

/** Number of significant digits: 1200 → 2 (stored as 12e2), 0 → 1. */
export function significantDigits(value: Decimal): number {
  return digitCount(value.coef);
}

/**
 * Rounds to at most `digits` significant digits, half to even. Used for
 * display; the stored value keeps full precision.
 */
export function roundToSignificant(value: Decimal, digits: number): Decimal {
  if (!Number.isInteger(digits) || digits < 1) throw new RangeError(`Bad digit count: ${digits}`);
  const drop = digitCount(value.coef) - digits;
  if (drop <= 0) return value;
  const rounded = roundCoefficient(value.coef, drop, false);
  return normalize(rounded.coef, value.exp + drop, value.exact && !rounded.inexact);
}

/**
 * Canonical text form, readable by parseDecimal and by the expression lexer.
 * Uses plain notation while it stays short, scientific otherwise.
 */
export function toCanonicalString(value: Decimal): string {
  const sign = value.coef < 0n ? '-' : '';
  const digits = abs(value.coef).toString();
  const exp = value.exp;
  if (exp >= 0 && exp <= 20) return sign + digits + '0'.repeat(exp);
  const pointAt = digits.length + exp;
  if (exp < 0 && pointAt > 0) return `${sign}${digits.slice(0, pointAt)}.${digits.slice(pointAt)}`;
  if (exp < 0 && pointAt > -20) return `${sign}0.${'0'.repeat(-pointAt)}${digits}`;
  const mantissa = digits.length > 1 ? `${digits[0] ?? ''}.${digits.slice(1)}` : digits;
  const adjusted = adjustedExponent(value);
  return `${sign}${mantissa}e${adjusted >= 0 ? '+' : ''}${adjusted}`;
}

/**
 * Brings a raw coefficient/exponent pair to canonical form: rounded to
 * PRECISION digits, trailing zeros removed, range checked.
 *
 * `sticky` tells that the true value is slightly larger in magnitude than
 * `coef` (there was a non-zero remainder beyond its last digit).
 */
function normalize(coef: bigint, exp: number, exact: boolean, sticky = false): Decimal {
  let c = coef;
  let e = exp;
  let isExact = exact && !sticky;

  const excess = digitCount(c) - PRECISION;
  if (excess > 0) {
    const rounded = roundCoefficient(c, excess, sticky);
    c = rounded.coef;
    e += excess;
    isExact = isExact && !rounded.inexact;
  }

  if (c === 0n) return isExact ? ZERO : { coef: 0n, exp: 0, exact: false };

  while (c % 10n === 0n) {
    c /= 10n;
    e += 1;
  }

  const adjusted = e + digitCount(c) - 1;
  if (adjusted > MAX_EXPONENT) throw new CalcError('overflow');
  // Too small to represent: flush to zero, and say it is not exact.
  if (adjusted < -MAX_EXPONENT) return { coef: 0n, exp: 0, exact: false };

  return { coef: c, exp: e, exact: isExact };
}

/** Removes `drop` trailing digits, rounding half to even. */
function roundCoefficient(
  coef: bigint,
  drop: number,
  sticky: boolean,
): { coef: bigint; inexact: boolean } {
  const negative = coef < 0n;
  const divisor = pow10(drop);
  const magnitude = abs(coef);
  let quotient = magnitude / divisor;
  const remainder = magnitude % divisor;
  const half = divisor / 2n;

  const roundUp = remainder > half || (remainder === half && (sticky || quotient % 2n === 1n));
  if (roundUp) quotient += 1n;

  return { coef: negative ? -quotient : quotient, inexact: remainder !== 0n || sticky };
}

function withExactness(value: Decimal, exact: boolean): Decimal {
  return value.exact === exact ? value : { coef: value.coef, exp: value.exp, exact };
}

function abs(n: bigint): bigint {
  return n < 0n ? -n : n;
}

function digitCount(n: bigint): number {
  return n === 0n ? 1 : abs(n).toString().length;
}

const POWERS_OF_TEN: bigint[] = [1n];

function pow10(n: number): bigint {
  if (n < 64) {
    for (let i = POWERS_OF_TEN.length; i <= n; i++) {
      POWERS_OF_TEN.push((POWERS_OF_TEN[i - 1] ?? 1n) * 10n);
    }
    return POWERS_OF_TEN[n] ?? 10n ** BigInt(n);
  }
  return 10n ** BigInt(n);
}
