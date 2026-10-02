import {
  add,
  divide,
  isZero,
  multiply,
  negate,
  percentOf,
  subtract,
  type Decimal,
} from './decimal';
import { CalcError } from './errors';
import { tokenize } from './lexer';
import { parse, type Node, type ParseOptions } from './parser';

/** Longest source `calculate` accepts. The keypad editor stays far below it. */
export const MAX_SOURCE_LENGTH = 2000;

/**
 * Evaluates a parsed expression.
 *
 * Percent follows the convention of desk calculators:
 *   - `a + b%` and `a − b%` mean a ± (a × b / 100): 200 + 10% = 220;
 *   - anywhere else `b%` is simply b / 100: 200 × 10% = 20, 10% = 0.1.
 * The first rule applies only when the percentage is the right operand of
 * `+` or `−` as written, so `200 + (10%)` is 200.1: parentheses opt out.
 */
export function evaluate(node: Node): Decimal {
  switch (node.kind) {
    case 'number':
      return node.value;
    case 'group':
      return evaluate(node.inner);
    case 'negate':
      return negate(evaluate(node.operand));
    case 'percent':
      return percentOf(evaluate(node.operand));
    case 'binary': {
      const left = evaluate(node.left);

      if (node.op === '+' || node.op === '-') {
        const fraction = bareFraction(node.right);
        if (fraction) {
          const share = multiply(left, fraction);
          return node.op === '+' ? add(left, share) : subtract(left, share);
        }
      }

      const right = evaluate(node.right);
      switch (node.op) {
        case '+':
          return add(left, right);
        case '-':
          return subtract(left, right);
        case '*':
          return multiply(left, right);
        case '/':
          if (isZero(right)) throw new CalcError('divisionByZero', node.right.span);
          return divide(left, right);
      }
    }
  }
}

/**
 * For `b%` or `−b%` written without parentheses, the fraction b/100 (with
 * its sign). For anything else, undefined.
 */
function bareFraction(node: Node): Decimal | undefined {
  if (node.kind === 'percent') return percentOf(evaluate(node.operand));
  if (node.kind === 'negate' && node.operand.kind === 'percent') {
    return negate(percentOf(evaluate(node.operand.operand)));
  }
  return undefined;
}

/** Parses and evaluates `source` in one go. Throws CalcError on bad input. */
export function calculate(source: string, options: ParseOptions = {}): Decimal {
  if (source.length > MAX_SOURCE_LENGTH) throw new CalcError('tooComplex');
  return evaluate(parse(tokenize(source), options).node);
}
