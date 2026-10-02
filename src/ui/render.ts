/**
 * Turns calculator state into DOM. Everything is built with
 * createElement/textContent — no innerHTML, so nothing typed or stored can
 * ever be interpreted as markup.
 */
import { pendingParens, preview, type State, type TapeEntry } from '../core/calculator';
import { parseDecimal, type Decimal } from '../core/decimal';
import { toSource } from '../core/editor';
import type { Span } from '../core/errors';
import {
  MINUS,
  decimalSeparator,
  expressionToText,
  formatDecimal,
  formatExpression,
  numberToText,
  type ExpressionPart,
  type FormattedNumber,
  type Locale,
} from '../core/format';
import { element } from './dom';
import { errorMessageKey, type Translate } from './i18n';

export interface DisplayElements {
  readonly meta: HTMLElement;
  readonly main: HTMLElement;
  readonly hint: HTMLElement;
}

// Numbers

export function renderNumber(number: FormattedNumber, locale: Locale): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const fraction = number.fraction ? decimalSeparator(locale) + number.fraction : '';
  fragment.append((number.negative ? MINUS : '') + number.integer + fraction);
  if (number.exponent !== null) {
    fragment.append('\u202f×\u202f10');
    const power = element('sup', 'power', String(number.exponent).replace('-', MINUS));
    fragment.append(power);
  }
  return fragment;
}

/** How a screen reader should say the number: no `^`, no superscripts. */
export function numberToSpeech(number: FormattedNumber, locale: Locale, t: Translate): string {
  if (number.exponent === null) return numberToText(number, locale);
  const mantissa = numberToText({ ...number, exponent: null }, locale);
  return t('number.power', { mantissa, exponent: String(number.exponent).replace('-', MINUS) });
}

/** `=` for exact results, `≈` for rounded ones. */
export function relationSign(value: Decimal, shown: FormattedNumber): '=' | '≈' {
  return value.exact && !shown.rounded ? '=' : '≈';
}

// Expressions

interface ExpressionOptions {
  readonly errorSpan?: Span | undefined;
  readonly ghostParens?: number;
}

export function renderExpression(
  parts: readonly ExpressionPart[],
  locale: Locale,
  options: ExpressionOptions = {},
): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const errorIndex = options.errorSpan ? errorPartIndex(parts, options.errorSpan) : -1;

  parts.forEach((part, index) => {
    const span = element('span', `part part--${part.kind}`);
    if (index === errorIndex) span.classList.add('part--error');
    if (part.kind === 'value') {
      span.append(renderNumber(part.number, locale));
      if (part.truncated) span.append(element('span', 'part__ellipsis', '…'));
    } else {
      span.textContent = part.kind === 'operator' ? `\u2009${part.text}\u2009` : part.text;
    }
    fragment.append(span);
  });

  if (options.ghostParens) {
    fragment.append(element('span', 'part part--ghost', ')'.repeat(options.ghostParens)));
  }
  return fragment;
}

/**
 * The part to underline for an error. An empty span at the very end (an
 * unfinished expression) points at the last part instead.
 */
function errorPartIndex(parts: readonly ExpressionPart[], span: Span): number {
  const index = parts.findIndex((p) => p.span.start < span.end && span.start < p.span.end);
  if (index !== -1) return index;
  return parts.findIndex((p) => p.span.start === span.start);
}

// Display

export function renderDisplay(
  elements: DisplayElements,
  state: State,
  locale: Locale,
  t: Translate,
): void {
  const { meta, main, hint } = elements;
  let chars = 1;
  hint.removeAttribute('data-kind');

  switch (state.mode) {
    case 'edit': {
      meta.replaceChildren();
      const ghostParens = pendingParens(state);
      if (state.expression.length === 0) {
        main.replaceChildren(element('span', 'display__placeholder', '0'));
      } else {
        const parts = formatExpression(toSource(state.expression), locale);
        main.replaceChildren(renderExpression(parts, locale, { ghostParens }));
        chars = expressionToText(parts, locale).length + ghostParens;
      }
      main.append(element('span', 'caret'));
      chars += 1;

      const value = preview(state);
      if (value) {
        const shown = formatDecimal(value, locale);
        hint.replaceChildren(`${relationSign(value, shown)} `, renderNumber(shown, locale));
      } else {
        hint.replaceChildren();
      }
      break;
    }
    case 'result': {
      const shown = formatDecimal(state.value, locale);
      const expression = element('span');
      expression.append(
        renderExpression(formatExpression(state.source, locale), locale),
        ` ${relationSign(state.value, shown)}`,
      );
      meta.replaceChildren(expression);
      main.replaceChildren(renderNumber(shown, locale));
      chars = numberToText(shown, locale).length;
      hint.replaceChildren();
      break;
    }
    case 'error': {
      meta.replaceChildren();
      const parts = formatExpression(toSource(state.expression), locale);
      const ghostParens = pendingParens(state);
      main.replaceChildren(
        renderExpression(parts, locale, { errorSpan: state.error.span, ghostParens }),
      );
      chars = expressionToText(parts, locale).length + ghostParens;
      hint.dataset.kind = 'error';
      hint.textContent = t(errorMessageKey(state.error.code));
      break;
    }
  }

  main.dataset.mode = state.mode;
  main.style.setProperty('--chars', String(chars));
  // Keep the end of a long expression in view, like a text field does.
  main.scrollLeft = main.scrollWidth;
}

// Tape

export function renderTapeEntry(
  entry: TapeEntry,
  locale: Locale,
  t: Translate,
  isNew: boolean,
): HTMLLIElement {
  const value = parseDecimal(entry.result);
  const shown = formatDecimal(value, locale);
  const exactValue: Decimal = { ...value, exact: entry.exact };
  const sign = relationSign(exactValue, shown);
  const parts = formatExpression(entry.source, locale);

  const button = element('button', isNew ? 'entry entry--new' : 'entry');
  button.type = 'button';
  button.dataset.id = String(entry.id);
  button.setAttribute(
    'aria-label',
    `${expressionToText(parts, locale)} ${sign} ${numberToSpeech(shown, locale, t)}`,
  );
  button.setAttribute('aria-describedby', 'tape-hint');

  const number = element('span', 'entry__number', String(entry.id).padStart(3, '0'));
  const hint = element('span', 'entry__hint', t('tape.insert'));
  const expression = element('span', 'entry__expression');
  expression.append(renderExpression(parts, locale));
  const result = element('span', 'entry__result');
  result.append(element('span', 'entry__sign', sign), '\u2009', renderNumber(shown, locale));
  for (const decorative of [number, hint]) decorative.setAttribute('aria-hidden', 'true');

  button.append(number, expression, hint, result);
  const item = element('li', 'tape__item');
  item.append(button);
  return item;
}
