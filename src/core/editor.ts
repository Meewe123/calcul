/**
 * The expression being typed, as a list of tokens, and the rules for every
 * key. The rules keep the expression well-formed while you type, so the
 * parser only ever sees something it can read (or something unfinished):
 *
 *   - no leading zeros, one decimal separator per number, digit limit;
 *   - an operator after an operator replaces it, except `×−` / `÷−`,
 *     which start a negative number;
 *   - a value next to a value gets an explicit `×`: `2(3)` becomes `2 × (3)`;
 *   - `)` only closes what is open; `%` only follows a complete operand.
 *
 * A key that does not fit is ignored: `press` returns the same array, which
 * lets callers tell "nothing happened" from a change.
 */
import { PRECISION } from './decimal';
import { tokenize, type Operator } from './lexer';

export type EditToken =
  /** Digits as typed, with at most one `.`: `0`, `12.`, `0.05`. */
  | { readonly kind: 'number'; readonly text: string }
  /**
   * A reused result in canonical form. Deleted as a whole by backspace.
   * `exact` is false if the result was rounded, so anything computed from
   * it is shown as approximate too.
   */
  | { readonly kind: 'value'; readonly text: string; readonly exact: boolean }
  | { readonly kind: 'operator'; readonly op: Operator }
  /** Unary minus. */
  | { readonly kind: 'minus' }
  | { readonly kind: 'open' }
  | { readonly kind: 'close' }
  | { readonly kind: 'percent' };

type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

export type Key =
  | Digit
  | '.'
  | Operator
  | '%'
  | '('
  | ')'
  /** One key for both parentheses: opens or closes, whichever makes sense. */
  | '()'
  | 'backspace';

/** Digits per typed number. Matches the arithmetic precision: every digit counts. */
export const MAX_DIGITS = PRECISION;

/** Tokens per expression. Long enough for real work, short enough to read. */
export const MAX_TOKENS = 100;

export type Expression = readonly EditToken[];

export const EMPTY: Expression = Object.freeze([]);

export function isDigitKey(key: Key): key is Digit {
  return key.length === 1 && key >= '0' && key <= '9';
}

export function press(tokens: Expression, key: Key): Expression {
  if (key === 'backspace') return backspace(tokens);
  if (isDigitKey(key)) return typeDigit(tokens, key);
  switch (key) {
    case '.':
      return typeDot(tokens);
    case '%':
      return endsWithOperand(tokens) && last(tokens)?.kind !== 'percent'
        ? push(seal(tokens), { kind: 'percent' })
        : tokens;
    case '(':
      return openParen(tokens);
    case ')':
      return closeParen(tokens);
    case '()':
      return openCount(tokens) > 0 && endsWithOperand(tokens)
        ? closeParen(tokens)
        : openParen(tokens);
    default:
      return typeOperator(tokens, key);
  }
}

/** Inserts a reused result. Next to another value it is multiplied. */
export function insertValue(tokens: Expression, canonical: string, exact: boolean): Expression {
  const value: EditToken = { kind: 'value', text: canonical, exact };
  return endsWithOperand(tokens) ? push(seal(tokens), OPERATOR_TIMES, value) : push(tokens, value);
}

/** Number of `(` without a matching `)`. */
export function openCount(tokens: Expression): number {
  let count = 0;
  for (const token of tokens) {
    if (token.kind === 'open') count += 1;
    else if (token.kind === 'close') count -= 1;
  }
  return count;
}

/** Canonical source for the lexer: `12+3*(4-1)%`. */
export function toSource(tokens: Expression): string {
  return tokens
    .map((token) => {
      switch (token.kind) {
        case 'number':
        case 'value':
          return token.text;
        case 'operator':
          return token.op;
        case 'minus':
          return '-';
        case 'open':
          return '(';
        case 'close':
          return ')';
        case 'percent':
          return '%';
      }
    })
    .join('');
}

/**
 * Builds tokens from canonical source (used for examples). Long or
 * scientific numbers become values; short ones stay editable digits.
 */
export function fromSource(source: string): Expression {
  const result: EditToken[] = [];
  for (const token of tokenize(source)) {
    const previous = result[result.length - 1];
    switch (token.type) {
      case 'number': {
        const digits = token.text.replace('.', '');
        const typed = /^\d*\.?\d*$/.test(token.text) && digits.length <= MAX_DIGITS;
        result.push(
          typed
            ? { kind: 'number', text: token.text }
            : { kind: 'value', text: token.text, exact: true },
        );
        break;
      }
      case 'operator': {
        const unary =
          token.op === '-' &&
          (!previous ||
            previous.kind === 'operator' ||
            previous.kind === 'minus' ||
            previous.kind === 'open');
        result.push(unary ? { kind: 'minus' } : { kind: 'operator', op: token.op });
        break;
      }
      case 'percent':
        result.push({ kind: 'percent' });
        break;
      case 'lparen':
        result.push({ kind: 'open' });
        break;
      case 'rparen':
        result.push({ kind: 'close' });
        break;
    }
  }
  return result;
}

/** False if any reused value in the expression was rounded. */
export function inputsExact(tokens: Expression): boolean {
  return tokens.every((token) => token.kind !== 'value' || token.exact);
}

/** True for a lone number, with or without a sign: nothing to calculate. */
export function isTrivial(tokens: Expression): boolean {
  const operands = tokens.filter((t) => t.kind !== 'minus');
  const only = operands[0];
  return operands.length === 1 && (only?.kind === 'number' || only?.kind === 'value');
}

/**
 * Drops what cannot be evaluated yet from the end (operators, signs, open
 * parentheses), so a live preview can show the result of what is there.
 */
export function trimIncomplete(tokens: Expression): Expression {
  let end = tokens.length;
  for (;;) {
    const token = tokens[end - 1];
    if (!token || !(token.kind === 'operator' || token.kind === 'minus' || token.kind === 'open')) {
      break;
    }
    end -= 1;
  }
  return end === tokens.length ? tokens : tokens.slice(0, end);
}

// Key handlers

const OPERATOR_TIMES: EditToken = Object.freeze({ kind: 'operator', op: '*' });

function typeDigit(tokens: Expression, digit: Digit): Expression {
  const tail = last(tokens);
  if (tail?.kind === 'number') {
    if (tail.text === '0') {
      return digit === '0' ? tokens : replaceLast(tokens, { kind: 'number', text: digit });
    }
    if (tail.text.replace('.', '').length >= MAX_DIGITS) return tokens;
    return replaceLast(tokens, { kind: 'number', text: tail.text + digit });
  }
  const number: EditToken = { kind: 'number', text: digit };
  return endsWithOperand(tokens) ? push(tokens, OPERATOR_TIMES, number) : push(tokens, number);
}

function typeDot(tokens: Expression): Expression {
  const tail = last(tokens);
  if (tail?.kind === 'number') {
    return tail.text.includes('.')
      ? tokens
      : replaceLast(tokens, { kind: 'number', text: tail.text + '.' });
  }
  const number: EditToken = { kind: 'number', text: '0.' };
  return endsWithOperand(tokens) ? push(tokens, OPERATOR_TIMES, number) : push(tokens, number);
}

function typeOperator(tokens: Expression, op: Operator): Expression {
  const tail = last(tokens);

  if (!tail || tail.kind === 'open') {
    return op === '-' ? push(tokens, { kind: 'minus' }) : tokens;
  }

  if (tail.kind === 'minus') {
    if (op === '-') return tokens;
    // `3 × −` then `+` means "I meant +": drop the sign, then treat `+`
    // as if it were typed right after `3 ×`.
    const withoutSign = tokens.slice(0, -1);
    return withoutSign.length > 0 && last(withoutSign)?.kind === 'operator'
      ? typeOperator(withoutSign, op)
      : withoutSign;
  }

  if (tail.kind === 'operator') {
    if (op === '-' && (tail.op === '*' || tail.op === '/')) return push(tokens, { kind: 'minus' });
    return tail.op === op ? tokens : replaceLast(tokens, { kind: 'operator', op });
  }

  return push(seal(tokens), { kind: 'operator', op });
}

function openParen(tokens: Expression): Expression {
  const open: EditToken = { kind: 'open' };
  return endsWithOperand(tokens) ? push(seal(tokens), OPERATOR_TIMES, open) : push(tokens, open);
}

function closeParen(tokens: Expression): Expression {
  return openCount(tokens) > 0 && endsWithOperand(tokens)
    ? push(seal(tokens), { kind: 'close' })
    : tokens;
}

function backspace(tokens: Expression): Expression {
  const tail = last(tokens);
  if (!tail) return tokens;
  if (tail.kind === 'number' && tail.text.length > 1) {
    return replaceLast(tokens, { kind: 'number', text: tail.text.slice(0, -1) });
  }
  return tokens.slice(0, -1);
}

// Helpers

function last(tokens: Expression): EditToken | undefined {
  return tokens[tokens.length - 1];
}

/** True when the expression ends with something that has a value. */
function endsWithOperand(tokens: Expression): boolean {
  const kind = last(tokens)?.kind;
  return kind === 'number' || kind === 'value' || kind === 'close' || kind === 'percent';
}

/** Removes a dangling decimal point before something else is appended: `5.` → `5`. */
function seal(tokens: Expression): Expression {
  const tail = last(tokens);
  return tail?.kind === 'number' && tail.text.endsWith('.')
    ? replaceLast(tokens, { kind: 'number', text: tail.text.slice(0, -1) })
    : tokens;
}

function push(tokens: Expression, ...added: EditToken[]): Expression {
  return tokens.length + added.length > MAX_TOKENS ? tokens : [...tokens, ...added];
}

function replaceLast(tokens: Expression, token: EditToken): Expression {
  return [...tokens.slice(0, -1), token];
}
