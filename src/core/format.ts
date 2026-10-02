/**
 * Turns numbers and expressions into what people read: localized decimal
 * separators, digit grouping, typographic operators, and a scientific form
 * for values that do not fit the display.
 *
 * Everything here returns structured parts rather than HTML, so the UI can
 * style them and tests can check them without a DOM.
 */
import {
  adjustedExponent,
  parseDecimal,
  roundToSignificant,
  significantDigits,
  type Decimal,
} from './decimal';
import type { Span } from './errors';
import { tokenize, type Token } from './lexer';

export type Locale = 'ru' | 'en';

/** Significant digits shown for a result. 16 fit a phone screen in a monospace font. */
export const DISPLAY_DIGITS = 16;

/** Numbers this small or smaller switch to scientific notation. */
const MIN_PLAIN_EXPONENT = -6;

interface NumberSymbols {
  readonly decimal: string;
  readonly group: string;
}

const SYMBOLS: Readonly<Record<Locale, NumberSymbols>> = {
  ru: { decimal: ',', group: '\u202f' }, // narrow no-break space, as Russian typography asks
  en: { decimal: '.', group: ',' },
};

export function decimalSeparator(locale: Locale): string {
  return SYMBOLS[locale].decimal;
}

export const MINUS = '−';

export interface FormattedNumber {
  readonly negative: boolean;
  /** Integer digits, grouped. In scientific form, the single leading digit. */
  readonly integer: string;
  /** Digits after the decimal separator; empty when there are none. */
  readonly fraction: string;
  /** Power of ten in scientific form, otherwise null. */
  readonly exponent: number | null;
  /** True when the shown value is not exactly the computed one. */
  readonly rounded: boolean;
}

export function formatDecimal(
  value: Decimal,
  locale: Locale,
  maxDigits: number = DISPLAY_DIGITS,
): FormattedNumber {
  const shown = roundToSignificant(value, maxDigits);
  const negative = shown.coef < 0n;
  const digits = (negative ? -shown.coef : shown.coef).toString();
  const rounded = !shown.exact;
  const adjusted = adjustedExponent(shown);

  if (shown.coef !== 0n && (adjusted >= maxDigits || adjusted < MIN_PLAIN_EXPONENT)) {
    return {
      negative,
      integer: digits.slice(0, 1),
      fraction: digits.slice(1),
      exponent: adjusted,
      rounded,
    };
  }

  let integer: string;
  let fraction: string;
  if (shown.exp >= 0) {
    integer = digits + '0'.repeat(shown.exp);
    fraction = '';
  } else {
    const pointAt = digits.length + shown.exp;
    integer = pointAt > 0 ? digits.slice(0, pointAt) : '0';
    fraction = pointAt > 0 ? digits.slice(pointAt) : '0'.repeat(-pointAt) + digits;
  }
  return { negative, integer: group(integer, locale), fraction, exponent: null, rounded };
}

/** The number as one line of text: `−1 234,5` or `1,5 × 10^21`. */
export function numberToText(number: FormattedNumber, locale: Locale): string {
  const sign = number.negative ? MINUS : '';
  const fraction = number.fraction ? decimalSeparator(locale) + number.fraction : '';
  const exponent = number.exponent === null ? '' : ` × 10^${number.exponent}`;
  return sign + number.integer + fraction + exponent;
}

/**
 * The number for the clipboard: no grouping, so spreadsheets and other
 * calculators accept it, and `E` notation for scientific form.
 */
export function numberToClipboard(number: FormattedNumber, locale: Locale): string {
  const sign = number.negative ? '-' : '';
  const integer = number.integer.split(SYMBOLS[locale].group).join('');
  const fraction = number.fraction ? decimalSeparator(locale) + number.fraction : '';
  const exponent = number.exponent === null ? '' : `E${number.exponent}`;
  return sign + integer + fraction + exponent;
}

function group(integer: string, locale: Locale): string {
  if (integer.length <= 3) return integer;
  const separator = SYMBOLS[locale].group;
  const head = integer.length % 3 || 3;
  let result = integer.slice(0, head);
  for (let i = head; i < integer.length; i += 3) result += separator + integer.slice(i, i + 3);
  return result;
}

// Expressions

export type ExpressionPart =
  /** A number as typed: grouped, with the locale's separator, trailing `,` kept. */
  | { readonly kind: 'number'; readonly text: string; readonly span: Span }
  /** A long or scientific literal, usually a reused result; shown rounded. */
  | {
      readonly kind: 'value';
      readonly number: FormattedNumber;
      readonly truncated: boolean;
      readonly span: Span;
    }
  | { readonly kind: 'operator'; readonly text: string; readonly span: Span }
  /** Unary minus, written next to its operand without a space. */
  | { readonly kind: 'sign'; readonly text: string; readonly span: Span }
  | { readonly kind: 'paren'; readonly text: '(' | ')'; readonly span: Span }
  | { readonly kind: 'percent'; readonly text: '%'; readonly span: Span };

/** Digits shown for a reused value inside an expression before it is cut with `…`. */
export const VALUE_DIGITS = 12;

const OPERATOR_GLYPHS = { '+': '+', '-': MINUS, '*': '×', '/': '÷' } as const;

/**
 * Splits a canonical expression into display parts. Spans point back into
 * `source`, so an error position from the parser can be highlighted.
 */
export function formatExpression(source: string, locale: Locale): ExpressionPart[] {
  const tokens = tokenize(source);
  return tokens.map((token, index) => formatToken(token, tokens[index - 1], locale));
}

function formatToken(token: Token, previous: Token | undefined, locale: Locale): ExpressionPart {
  switch (token.type) {
    case 'number':
      return formatLiteral(token.text, token.span, locale);
    case 'operator': {
      const text = OPERATOR_GLYPHS[token.op];
      const unary =
        token.op === '-' &&
        (!previous || previous.type === 'operator' || previous.type === 'lparen');
      return { kind: unary ? 'sign' : 'operator', text, span: token.span };
    }
    case 'percent':
      return { kind: 'percent', text: '%', span: token.span };
    case 'lparen':
      return { kind: 'paren', text: '(', span: token.span };
    case 'rparen':
      return { kind: 'paren', text: ')', span: token.span };
  }
}

function formatLiteral(text: string, span: Span, locale: Locale): ExpressionPart {
  const [integer = '', fraction] = text.split('.');
  const looksTyped = !/e/i.test(text) && integer.length + (fraction ?? '').length <= DISPLAY_DIGITS;
  if (looksTyped) {
    const intPart = group(integer || '0', locale);
    return {
      kind: 'number',
      text: fraction === undefined ? intPart : intPart + decimalSeparator(locale) + fraction,
      span,
    };
  }
  const value = parseDecimal(text);
  return {
    kind: 'value',
    number: formatDecimal(value, locale, VALUE_DIGITS),
    truncated: significantDigits(value) > VALUE_DIGITS,
    span,
  };
}

/** One line of text for an expression, e.g. for screen readers and copying the tape. */
export function expressionToText(parts: readonly ExpressionPart[], locale: Locale): string {
  return parts
    .map((part) => {
      switch (part.kind) {
        case 'operator':
          return ` ${part.text} `;
        case 'value':
          return numberToText(part.number, locale) + (part.truncated ? '…' : '');
        default:
          return part.text;
      }
    })
    .join('');
}
