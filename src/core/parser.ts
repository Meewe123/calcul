/**
 * Recursive-descent parser. Grammar, from the loosest binding to the tightest:
 *
 *   expression := term (('+' | '-') term)*
 *   term       := unary (('*' | '/') unary)*
 *   unary      := '-' unary | postfix
 *   postfix    := primary '%'*
 *   primary    := NUMBER | '(' expression ')'
 *
 * Binary operators are left-associative: 8 − 3 − 2 = (8 − 3) − 2.
 * With `autoClose`, parentheses left open at the end are closed implicitly,
 * so `2 × (3 + 4` is read as `2 × (3 + 4)` — the way people type.
 */
import { parseDecimal, type Decimal } from './decimal';
import { CalcError, type Span } from './errors';
import type { Operator, Token } from './lexer';

export type Node =
  | { readonly kind: 'number'; readonly value: Decimal; readonly span: Span }
  | { readonly kind: 'negate'; readonly operand: Node; readonly span: Span }
  | { readonly kind: 'percent'; readonly operand: Node; readonly span: Span }
  /** Parentheses. Kept in the tree because they change how `%` reads. */
  | { readonly kind: 'group'; readonly inner: Node; readonly span: Span }
  | {
      readonly kind: 'binary';
      readonly op: Operator;
      readonly left: Node;
      readonly right: Node;
      readonly span: Span;
    };

export interface ParseOptions {
  /** Close parentheses that are still open at the end. Default: false. */
  readonly autoClose?: boolean;
}

export interface ParseResult {
  readonly node: Node;
  /** How many `)` were added at the end by `autoClose`. */
  readonly missingParens: number;
}

/** Deepest nesting of parentheses and unary minuses the parser accepts. */
export const MAX_DEPTH = 64;

export function parse(tokens: readonly Token[], options: ParseOptions = {}): ParseResult {
  return new Parser(tokens, options.autoClose ?? false).parseAll();
}

class Parser {
  private pos = 0;
  private depth = 0;
  private missingParens = 0;
  private readonly tokens: readonly Token[];
  private readonly autoClose: boolean;

  constructor(tokens: readonly Token[], autoClose: boolean) {
    this.tokens = tokens;
    this.autoClose = autoClose;
  }

  parseAll(): ParseResult {
    if (this.tokens.length === 0) throw new CalcError('empty');
    const node = this.expression();
    const extra = this.peek();
    if (extra) throw new CalcError('unexpectedToken', extra.span);
    return { node, missingParens: this.missingParens };
  }

  private expression(): Node {
    let node = this.term();
    for (let token = this.peek(); token?.type === 'operator'; token = this.peek()) {
      if (token.op !== '+' && token.op !== '-') break;
      this.pos += 1;
      const right = this.term();
      node = { kind: 'binary', op: token.op, left: node, right, span: join(node.span, right.span) };
    }
    return node;
  }

  private term(): Node {
    let node = this.unary();
    for (let token = this.peek(); token?.type === 'operator'; token = this.peek()) {
      if (token.op !== '*' && token.op !== '/') break;
      this.pos += 1;
      const right = this.unary();
      node = { kind: 'binary', op: token.op, left: node, right, span: join(node.span, right.span) };
    }
    return node;
  }

  private unary(): Node {
    const token = this.peek();
    if (token?.type === 'operator' && token.op === '-') {
      this.pos += 1;
      const operand = this.nested(() => this.unary());
      return { kind: 'negate', operand, span: join(token.span, operand.span) };
    }
    return this.postfix();
  }

  private postfix(): Node {
    let node = this.primary();
    for (let token = this.peek(); token?.type === 'percent'; token = this.peek()) {
      this.pos += 1;
      node = { kind: 'percent', operand: node, span: join(node.span, token.span) };
    }
    return node;
  }

  private primary(): Node {
    const token = this.peek();
    if (!token) throw new CalcError('incomplete', this.endSpan());

    if (token.type === 'number') {
      this.pos += 1;
      return { kind: 'number', value: parseDecimal(token.text), span: token.span };
    }

    if (token.type === 'lparen') {
      this.pos += 1;
      const inner = this.nested(() => this.expression());
      const close = this.peek();
      if (close?.type === 'rparen') {
        this.pos += 1;
        return { kind: 'group', inner, span: join(token.span, close.span) };
      }
      if (close) throw new CalcError('unexpectedToken', close.span);
      if (!this.autoClose) throw new CalcError('unclosedParen', token.span);
      this.missingParens += 1;
      return { kind: 'group', inner, span: join(token.span, inner.span) };
    }

    throw new CalcError('unexpectedToken', token.span);
  }

  private nested(parseInner: () => Node): Node {
    this.depth += 1;
    if (this.depth > MAX_DEPTH) throw new CalcError('tooComplex', this.peek()?.span);
    try {
      return parseInner();
    } finally {
      this.depth -= 1;
    }
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private endSpan(): Span {
    const end = this.tokens[this.tokens.length - 1]?.span.end ?? 0;
    return { start: end, end };
  }
}

function join(a: Span, b: Span): Span {
  return { start: Math.min(a.start, b.start), end: Math.max(a.end, b.end) };
}
