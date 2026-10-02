/** Where in the source an error happened, as character offsets [start, end). */
export interface Span {
  readonly start: number;
  readonly end: number;
}

export type CalcErrorCode =
  /** Division with a zero divisor. */
  | 'divisionByZero'
  /** The result does not fit into the supported exponent range. */
  | 'overflow'
  /** Nothing to evaluate. */
  | 'empty'
  /** The expression stops where an operand is expected, e.g. `2 +`. */
  | 'incomplete'
  /** A token that cannot stand where it is, e.g. `2 + * 3` or a stray `)`. */
  | 'unexpectedToken'
  /** A character the calculator does not understand. */
  | 'unexpectedCharacter'
  /** An opening parenthesis without a closing one (only when auto-closing is off). */
  | 'unclosedParen'
  /** Nesting deeper than the parser allows. */
  | 'tooComplex';

/**
 * The only error type the core throws on purpose. Anything else escaping the
 * core is a bug and is reported as such by the UI.
 */
export class CalcError extends Error {
  readonly code: CalcErrorCode;
  readonly span: Span | undefined;

  constructor(code: CalcErrorCode, span?: Span) {
    super(span ? `${code} at ${span.start}..${span.end}` : code);
    this.name = 'CalcError';
    this.code = code;
    this.span = span;
  }
}

export function isCalcError(error: unknown): error is CalcError {
  return error instanceof CalcError;
}
