/**
 * The whole calculator as a pure state machine: `reduce(state, action)`
 * returns the next state and never touches the DOM or storage. The UI
 * renders states and turns clicks and key presses into actions.
 *
 *   edit ──=──▶ result        (the calculation is printed on the tape)
 *   edit ──=──▶ error         (the expression stays, so it can be fixed)
 *   result ──digit──▶ edit    (a new calculation)
 *   result ──operator──▶ edit (continues from the result)
 *   error ──any key──▶ edit
 */
import { toCanonicalString, type Decimal } from './decimal';
import {
  EMPTY,
  fromSource,
  inputsExact,
  insertValue,
  isDigitKey,
  isTrivial,
  openCount,
  press,
  toSource,
  trimIncomplete,
  type Expression,
  type Key,
} from './editor';
import { CalcError, isCalcError } from './errors';
import { evaluate } from './evaluate';
import { tokenize } from './lexer';
import { parse } from './parser';

export interface TapeEntry {
  readonly id: number;
  /** Canonical expression, with auto-closed parentheses written out. */
  readonly source: string;
  /** Canonical result, full precision. */
  readonly result: string;
  /** False when the result was rounded. */
  readonly exact: boolean;
}

/** Oldest entries fall off the tape beyond this. */
export const MAX_TAPE_ENTRIES = 500;

export type State =
  | {
      readonly mode: 'edit';
      readonly expression: Expression;
      readonly tape: readonly TapeEntry[];
    }
  | {
      readonly mode: 'result';
      readonly value: Decimal;
      /** The calculation that produced the value. */
      readonly source: string;
      readonly tape: readonly TapeEntry[];
    }
  | {
      readonly mode: 'error';
      readonly expression: Expression;
      readonly error: CalcError;
      readonly tape: readonly TapeEntry[];
    };

export type Action =
  | { readonly type: 'press'; readonly key: Key }
  | { readonly type: 'evaluate' }
  | { readonly type: 'clear' }
  /** Reuse a result from the tape in the current expression. */
  | { readonly type: 'insert'; readonly value: string; readonly exact: boolean }
  /** Replace the expression with `source` and evaluate it (the examples). */
  | { readonly type: 'run'; readonly source: string }
  | { readonly type: 'setTape'; readonly tape: readonly TapeEntry[] };

export function createState(tape: readonly TapeEntry[] = []): State {
  return { mode: 'edit', expression: EMPTY, tape };
}

export function reduce(state: State, action: Action): State {
  switch (action.type) {
    case 'press':
      return pressKey(state, action.key);
    case 'evaluate':
      return state.mode === 'result' ? state : evaluateExpression(state.expression, state.tape);
    case 'clear':
      return state.mode === 'edit' && state.expression.length === 0
        ? state
        : createState(state.tape);
    case 'insert':
      return edit(
        state,
        insertValue(currentExpression(state, 'fresh'), action.value, action.exact),
      );
    case 'run':
      return evaluateExpression(fromSource(action.source), state.tape);
    case 'setTape':
      return { ...state, tape: action.tape };
  }
}

/**
 * The live result under the expression while typing, or null when there is
 * nothing worth showing: a lone number, an error, or nothing at all.
 * Unfinished endings (`12 + 3 ×`) are ignored, open parentheses closed.
 */
export function preview(state: State): Decimal | null {
  if (state.mode !== 'edit') return null;
  const expression = trimIncomplete(state.expression);
  if (expression.length === 0 || isTrivial(expression)) return null;
  try {
    const value = evaluate(parse(tokenize(toSource(expression)), { autoClose: true }).node);
    return withInputs(value, expression);
  } catch (error) {
    if (isCalcError(error)) return null;
    throw error;
  }
}

/** The expression on screen, for the edit and error modes. */
export function expressionOf(state: State): Expression {
  return state.mode === 'result' ? EMPTY : state.expression;
}

/** How many `)` the display should show as pending. */
export function pendingParens(state: State): number {
  return state.mode === 'result' ? 0 : openCount(state.expression);
}

function pressKey(state: State, key: Key): State {
  if (state.mode === 'result') {
    if (key === 'backspace') return createState(state.tape);
    // A digit, a point or `(` starts a new calculation; anything else
    // continues from the result.
    const fresh = isDigitKey(key) || key === '.' || key === '(' || key === '()';
    return edit(state, press(currentExpression(state, fresh ? 'fresh' : 'continue'), key));
  }
  return edit(state, press(state.expression, key));
}

function currentExpression(state: State, afterResult: 'fresh' | 'continue'): Expression {
  if (state.mode !== 'result') return state.expression;
  if (afterResult === 'fresh') return EMPTY;
  return [{ kind: 'value', text: toCanonicalString(state.value), exact: state.value.exact }];
}

function edit(state: State, expression: Expression): State {
  return { mode: 'edit', expression, tape: state.tape };
}

function evaluateExpression(expression: Expression, tape: readonly TapeEntry[]): State {
  if (expression.length === 0) return { mode: 'edit', expression, tape };
  const source = toSource(expression);
  try {
    const { node, missingParens } = parse(tokenize(source), { autoClose: true });
    const value = withInputs(evaluate(node), expression);
    const fullSource = source + ')'.repeat(missingParens);
    const nextTape = isTrivial(expression)
      ? tape
      : appendEntry(tape, {
          source: fullSource,
          result: toCanonicalString(value),
          exact: value.exact,
        });
    return { mode: 'result', value, source: fullSource, tape: nextTape };
  } catch (error) {
    if (isCalcError(error)) return { mode: 'error', expression, error, tape };
    throw error;
  }
}

/** A result computed from a rounded input is itself approximate. */
function withInputs(value: Decimal, expression: Expression): Decimal {
  return value.exact && !inputsExact(expression) ? { ...value, exact: false } : value;
}

function appendEntry(
  tape: readonly TapeEntry[],
  entry: Omit<TapeEntry, 'id'>,
): readonly TapeEntry[] {
  const id = tape.reduce((max, e) => Math.max(max, e.id), 0) + 1;
  const next = [...tape, { id, ...entry }];
  return next.length > MAX_TAPE_ENTRIES ? next.slice(next.length - MAX_TAPE_ENTRIES) : next;
}
