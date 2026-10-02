/**
 * Turns an expression string into tokens. Accepts the canonical ASCII form
 * (`12+3*(4-1)%`) and the typographic one (`12 + 3 × (4 − 1)%`). The decimal
 * separator is always a dot here: locale-specific input is normalised before
 * it reaches the core (see `paste.ts`).
 */
import { CalcError, type Span } from './errors';

export type Operator = '+' | '-' | '*' | '/';

export type Token =
  | { readonly type: 'number'; readonly text: string; readonly span: Span }
  | { readonly type: 'operator'; readonly op: Operator; readonly span: Span }
  | { readonly type: 'percent'; readonly span: Span }
  | { readonly type: 'lparen'; readonly span: Span }
  | { readonly type: 'rparen'; readonly span: Span };

const OPERATORS: Readonly<Record<string, Operator>> = {
  '+': '+',
  '-': '-',
  '−': '-', // − minus sign
  '*': '*',
  '×': '*', // × multiplication sign
  '/': '/',
  '÷': '/', // ÷ division sign
};

const isDigit = (char: string | undefined): boolean =>
  char !== undefined && char >= '0' && char <= '9';

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const char = source[i] ?? '';
    const start = i;

    if (/\s/.test(char)) {
      i += 1;
    } else if (isDigit(char) || char === '.') {
      i = scanNumber(source, i);
      tokens.push({ type: 'number', text: source.slice(start, i), span: { start, end: i } });
    } else if (char in OPERATORS) {
      tokens.push({ type: 'operator', op: OPERATORS[char] ?? '+', span: { start, end: i + 1 } });
      i += 1;
    } else if (char === '%' || char === '(' || char === ')') {
      const type = char === '%' ? 'percent' : char === '(' ? 'lparen' : 'rparen';
      tokens.push({ type, span: { start, end: i + 1 } });
      i += 1;
    } else {
      throw new CalcError('unexpectedCharacter', { start, end: i + 1 });
    }
  }

  return tokens;
}

/** Returns the index right after the number that starts at `start`. */
function scanNumber(source: string, start: number): number {
  let i = start;
  let digits = 0;
  while (isDigit(source[i])) {
    i += 1;
    digits += 1;
  }
  if (source[i] === '.') {
    i += 1;
    while (isDigit(source[i])) {
      i += 1;
      digits += 1;
    }
  }
  if (digits === 0) throw new CalcError('unexpectedCharacter', { start, end: i });

  if (source[i] === 'e' || source[i] === 'E') {
    let j = i + 1;
    if (source[j] === '+' || source[j] === '-') j += 1;
    if (!isDigit(source[j])) throw new CalcError('unexpectedCharacter', { start: i, end: i + 1 });
    while (isDigit(source[j])) j += 1;
    i = j;
  }
  return i;
}
