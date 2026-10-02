/**
 * Wires the page to the calculator: events become actions, every new state
 * is rendered, the tape is saved. All calculation rules live in src/core.
 */
import { createState, reduce, preview, type Action, type State } from '../core/calculator';
import { parseDecimal } from '../core/decimal';
import { isTrivial, toSource, type Key } from '../core/editor';
import {
  decimalSeparator,
  expressionToText,
  formatDecimal,
  formatExpression,
  numberToClipboard,
  type Locale,
} from '../core/format';
import { readPaste } from '../core/paste';
import { parseTape, serializeTape, tapeToText } from '../core/tape';
import { copyText } from './clipboard';
import { byId } from './dom';
import {
  detectLocale,
  errorMessageKey,
  isLocale,
  isMessageKey,
  translator,
  type Translate,
} from './i18n';
import { commandForKey, type Command } from './keyboard';
import { logger } from './logger';
import { numberToSpeech, relationSign, renderDisplay, renderTapeEntry } from './render';
import { STORAGE_KEYS, createStorage } from './storage';
import { applyTheme, isThemePreference, nextTheme, type ThemePreference } from './theme';
import { createToast } from './toast';

const KEY_FLASH_MS = 110;

export function startApp(): void {
  const doc = document;
  const root = doc.documentElement;
  const storage = createStorage(() => window.localStorage);

  const display = {
    meta: byId('display-meta', HTMLElement),
    main: byId('display-main', HTMLElement),
    hint: byId('display-hint', HTMLElement),
  };
  const keypad = byId('keypad', HTMLElement);
  const tapeList = byId('tape-list', HTMLOListElement);
  const tapeEmpty = byId('tape-empty', HTMLElement);
  const tapeScroll = byId('tape-scroll', HTMLElement);
  const tapeCopy = byId('tape-copy', HTMLButtonElement);
  const tapeClear = byId('tape-clear', HTMLButtonElement);
  const themeToggle = byId('theme-toggle', HTMLButtonElement);
  const themeValue = byId('theme-value', HTMLElement);
  const shortcuts = byId('shortcuts', HTMLDialogElement);
  const announcer = byId('announcer', HTMLElement);
  const toast = createToast(
    byId('toast', HTMLElement),
    byId('toast-text', HTMLElement),
    byId('toast-action', HTMLButtonElement),
  );

  let locale: Locale = detectLocale(
    location.search,
    storage.read(STORAGE_KEYS.lang),
    navigator.languages,
  );
  let t: Translate = translator(locale);
  const savedTheme = storage.read(STORAGE_KEYS.theme);
  let theme: ThemePreference = isThemePreference(savedTheme) ? savedTheme : 'system';
  let state: State = createState(parseTape(storage.read(STORAGE_KEYS.tape)));

  // Rendering

  function renderTape(newFromId: number): void {
    const { tape } = state;
    tapeEmpty.hidden = tape.length > 0;
    for (const button of [tapeCopy, tapeClear]) {
      button.setAttribute('aria-disabled', String(tape.length === 0));
    }
    tapeList.replaceChildren(
      ...tape.map((entry) => renderTapeEntry(entry, locale, t, entry.id >= newFromId)),
    );
    tapeScroll.scrollTop = tape.length > 0 ? tapeScroll.scrollHeight : 0;
  }

  function renderStatic(): void {
    root.lang = locale;
    doc.title = t('meta.title');
    doc.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.description'));
    for (const node of doc.querySelectorAll<HTMLElement>('[data-i18n]')) {
      const key = node.dataset.i18n;
      if (isMessageKey(key)) node.textContent = t(key);
    }
    for (const node of doc.querySelectorAll<HTMLElement>('[data-i18n-label]')) {
      const key = node.dataset.i18nLabel;
      if (isMessageKey(key)) node.setAttribute('aria-label', t(key));
    }
    for (const button of doc.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
      button.setAttribute('aria-pressed', String(button.dataset.lang === locale));
    }
    byId('key-point', HTMLButtonElement).textContent = decimalSeparator(locale);
    for (const node of doc.querySelectorAll<HTMLElement>('[data-example-expression]')) {
      const source = node.closest<HTMLElement>('[data-example]')?.dataset.example;
      if (source) node.textContent = expressionToText(formatExpression(source, locale), locale);
    }
    if (/Mac|iPhone|iPad/.test(navigator.platform)) {
      for (const kbd of doc.querySelectorAll('kbd')) {
        if (kbd.textContent === 'Ctrl') kbd.textContent = '⌘';
      }
    }
    renderTheme();
  }

  function renderTheme(): void {
    themeValue.textContent = t(`theme.${theme}`);
    themeToggle.setAttribute('aria-label', `${t('theme.label')}: ${t(`theme.${theme}`)}`);
  }

  function renderAll(): void {
    renderStatic();
    renderDisplay(display, state, locale, t);
    renderTape(Number.POSITIVE_INFINITY);
  }

  // State changes

  function dispatch(...actions: Action[]): void {
    const previous = state;
    state = actions.reduce(reduce, state);
    if (state === previous) return;

    renderDisplay(display, state, locale, t);
    if (state.tape !== previous.tape) {
      const lastId = previous.tape.at(-1)?.id ?? 0;
      renderTape(state.tape.length > previous.tape.length ? lastId + 1 : Number.POSITIVE_INFINITY);
      storage.write(STORAGE_KEYS.tape, serializeTape(state.tape));
    }
    announce(previous);
  }

  function announce(previous: State): void {
    if (state.mode === 'result' && previous.mode !== 'result') {
      const shown = formatDecimal(state.value, locale);
      const key =
        relationSign(state.value, shown) === '=' ? 'announce.result' : 'announce.approximate';
      announcer.textContent = t(key, { value: numberToSpeech(shown, locale, t) });
    } else if (state.mode === 'error' && previous.mode !== 'error') {
      announcer.textContent = t(errorMessageKey(state.error.code));
    }
  }

  /** Lights up the on-screen key when the same key is typed on a keyboard. */
  function flashKey(command: Command): void {
    let selector = `[data-action="${command.type}"]`;
    if (command.type === 'press') {
      // Both parentheses live on one on-screen key.
      const key = command.key === '(' || command.key === ')' ? '()' : command.key;
      selector = `[data-key="${key}"]`;
    }
    const key = keypad.querySelector(selector);
    if (!key) return;
    key.classList.add('is-pressed');
    window.setTimeout(() => {
      key.classList.remove('is-pressed');
    }, KEY_FLASH_MS);
  }

  // Values for the clipboard

  /** What Ctrl+C copies when nothing is selected: the result, or the live preview. */
  function valueToCopy(): string | null {
    if (state.mode === 'result')
      return numberToClipboard(formatDecimal(state.value, locale), locale);
    if (state.mode !== 'edit' || state.expression.length === 0) return null;
    if (isTrivial(state.expression)) {
      return numberToClipboard(
        formatDecimal(parseDecimal(toSource(state.expression)), locale),
        locale,
      );
    }
    const value = preview(state);
    return value ? numberToClipboard(formatDecimal(value, locale), locale) : null;
  }

  // Events

  keypad.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button) return;
    const { key, action } = button.dataset;
    if (key) dispatch({ type: 'press', key: key as Key });
    else if (action === 'evaluate') dispatch({ type: 'evaluate' });
    else if (action === 'clear') dispatch({ type: 'clear' });
  });

  // A button clicked with the mouse keeps focus. Enter or Space on it would
  // press it again, so remember which control got focus from a pointer: for
  // that one, Enter means `=`. A control reached with Tab keeps its keys.
  let pointerFocused: Element | null = null;
  doc.addEventListener(
    'pointerdown',
    (event) => {
      pointerFocused = event.target instanceof Element ? event.target.closest('button, a') : null;
    },
    { capture: true },
  );

  doc.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.isComposing) return;
    if (event.target instanceof Element && event.target.closest('dialog')) return;

    const active = doc.activeElement;
    const keyboardFocused =
      active instanceof HTMLElement && active !== doc.body && active !== pointerFocused;
    if (event.key === 'Tab') pointerFocused = null;
    if (event.key === ' ' && !keyboardFocused) event.preventDefault();

    const command = commandForKey(event);
    if (!command) return;
    if (event.key === 'Enter' && keyboardFocused) return;

    event.preventDefault();
    dispatch(command);
    flashKey(command);
  });

  doc.addEventListener('copy', (event) => {
    if (doc.getSelection()?.toString()) return;
    const text = valueToCopy();
    if (text === null || !event.clipboardData) return;
    event.preventDefault();
    event.clipboardData.setData('text/plain', text);
    toast.show(t('toast.copied', { value: text }));
  });

  doc.addEventListener('paste', (event) => {
    const text = event.clipboardData?.getData('text/plain') ?? '';
    const result = readPaste(text, locale);
    event.preventDefault();
    if (result.ok) {
      dispatch(...result.keys.map((key): Action => ({ type: 'press', key })));
    } else if (result.reason === 'unexpectedCharacter') {
      toast.show(t('paste.unexpectedCharacter', { value: result.character }));
    } else if (result.reason === 'ambiguousNumber') {
      toast.show(t('paste.ambiguousNumber', { value: result.number }));
    } else if (result.reason === 'tooLong') {
      toast.show(t('paste.tooLong'));
    }
  });

  tapeList.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('.entry');
    const entry = state.tape.find((e) => String(e.id) === button?.dataset.id);
    if (entry) dispatch({ type: 'insert', value: entry.result, exact: entry.exact });
  });

  tapeEmpty.addEventListener('click', (event) => {
    const source = (event.target as Element).closest<HTMLElement>('[data-example]')?.dataset
      .example;
    if (source) dispatch({ type: 'run', source });
  });

  tapeCopy.addEventListener('click', () => {
    if (state.tape.length === 0) {
      toast.show(t('toast.tapeEmpty'));
      return;
    }
    void copyText(tapeToText(state.tape, locale)).then((ok) => {
      toast.show(t(ok ? 'toast.tapeCopied' : 'toast.copyFailed'));
    });
  });

  tapeClear.addEventListener('click', () => {
    const saved = state.tape;
    if (saved.length === 0) return;
    dispatch({ type: 'setTape', tape: [] });
    toast.show(t('toast.tapeCleared'), {
      label: t('toast.undo'),
      run: () => {
        if (state.tape.length === 0) dispatch({ type: 'setTape', tape: saved });
      },
    });
  });

  for (const button of doc.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
    button.addEventListener('click', () => {
      const next = button.dataset.lang;
      if (!isLocale(next) || next === locale) return;
      locale = next;
      t = translator(locale);
      storage.write(STORAGE_KEYS.lang, locale);
      const url = new URL(location.href);
      if (url.searchParams.has('lang')) {
        url.searchParams.set('lang', locale);
        history.replaceState(null, '', url);
      }
      renderAll();
    });
  }

  themeToggle.addEventListener('click', () => {
    theme = nextTheme(theme);
    applyTheme(root, theme);
    storage.write(STORAGE_KEYS.theme, theme);
    renderTheme();
  });

  byId('shortcuts-open', HTMLButtonElement).addEventListener('click', () => {
    shortcuts.showModal();
  });
  shortcuts.addEventListener('click', (event) => {
    // A click on the backdrop lands on the dialog element itself.
    if (event.target === shortcuts) shortcuts.close();
  });

  let crashed = false;
  const onCrash = (error: unknown): void => {
    logger.error('Unexpected error', error);
    if (!crashed) toast.show(t('toast.crash'));
    crashed = true;
  };
  window.addEventListener('error', (event) => {
    onCrash(event.error);
  });
  window.addEventListener('unhandledrejection', (event) => {
    onCrash(event.reason);
  });

  // First render

  applyTheme(root, theme);
  renderAll();
  if (!storage.persistent) toast.show(t('toast.noStorage'));
}
