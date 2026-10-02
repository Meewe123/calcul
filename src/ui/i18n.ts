/**
 * Interface texts in Russian and English, and the choice between them.
 * Static texts in index.html carry `data-i18n*` attributes and are filled
 * from here; the HTML itself ships in Russian.
 */
import type { CalcErrorCode } from '../core/errors';
import type { Locale } from '../core/format';

const ru = {
  'meta.title': 'calcul — калькулятор с лентой',
  'meta.description':
    'Калькулятор, который считает точно и печатает каждый расчёт на ленту. Скобки, проценты, тёмная тема.',
  tagline: 'калькулятор с лентой',

  'lang.label': 'Язык интерфейса',
  'theme.label': 'Тема',
  'theme.system': 'авто',
  'theme.light': 'светлая',
  'theme.dark': 'тёмная',
  'shortcuts.open': 'Клавиши',

  'machine.label': 'Калькулятор',
  'display.label': 'Табло',
  'keypad.label': 'Клавиатура калькулятора',
  'key.clear': 'Сбросить',
  'key.parens': 'Скобка',
  'key.percent': 'Процент',
  'key.divide': 'Разделить',
  'key.multiply': 'Умножить',
  'key.subtract': 'Вычесть',
  'key.add': 'Прибавить',
  'key.point': 'Десятичная запятая',
  'key.backspace': 'Стереть',
  'key.equals': 'Посчитать',

  'tape.title': 'Лента',
  'tape.copy': 'Копировать',
  'tape.clear': 'Очистить',
  'tape.entryHint': 'Нажмите, чтобы взять результат в расчёт',
  'tape.insert': 'в расчёт',
  'tape.emptyTitle': 'Здесь печатается каждый расчёт',
  'tape.emptyText': 'Нажмите на результат, чтобы продолжить с ним. Попробуйте:',
  'example.exact': 'ровно 0,3 — без ошибки двоичных дробей',
  'example.percent': 'скидка 15 %: процент считается от суммы',
  'example.rounded': '≈ значит «результат округлён»',

  'footer.facts': 'Десятичная арифметика: 34 значащие цифры, округление до чётного.',
  'footer.source': 'Исходный код',

  'error.divisionByZero': 'На ноль делить нельзя',
  'error.overflow': 'Число слишком большое',
  'error.incomplete': 'Выражение не закончено',
  'error.tooComplex': 'Слишком сложное выражение',
  'error.unreadable': 'Не получается прочитать выражение',

  'paste.unexpectedCharacter': 'Не вставлено: непонятный символ «{value}»',
  'paste.ambiguousNumber': 'Не вставлено: непонятно, где дробная часть в «{value}»',
  'paste.tooLong': 'Не вставлено: слишком длинный текст',

  'toast.copied': 'Скопировано: {value}',
  'toast.tapeCopied': 'Лента скопирована',
  'toast.tapeEmpty': 'Лента пока пустая',
  'toast.tapeCleared': 'Лента очищена',
  'toast.undo': 'Вернуть',
  'toast.copyFailed': 'Не получилось скопировать: браузер не дал доступ к буферу обмена',
  'toast.noStorage': 'Лента не сохранится: браузер запрещает хранить данные',
  'toast.crash': 'Что-то пошло не так. Обновите страницу — лента сохранена.',

  'announce.result': 'Результат: {value}',
  'announce.approximate': 'Результат примерно: {value}',
  'number.power': '{mantissa} умножить на 10 в степени {exponent}',

  'shortcuts.title': 'Клавиатура',
  'shortcuts.digits': 'цифры, запятая или точка',
  'shortcuts.operators': 'сложение, вычитание, умножение, деление',
  'shortcuts.parens': 'скобки и процент',
  'shortcuts.equals': 'посчитать',
  'shortcuts.backspace': 'стереть последний знак',
  'shortcuts.clear': 'сбросить выражение',
  'shortcuts.copy': 'скопировать результат',
  'shortcuts.paste': 'вставить выражение из буфера',
  'shortcuts.or': 'или',
  'shortcuts.close': 'Закрыть',

  noscript: 'Калькулятору нужен JavaScript. Включите его в настройках браузера.',
} as const;

export type MessageKey = keyof typeof ru;

const en: Record<MessageKey, string> = {
  'meta.title': 'calcul — a calculator with a paper tape',
  'meta.description':
    'A calculator that gets decimals right and prints every calculation on a tape. Parentheses, percentages, dark theme.',
  tagline: 'a calculator with a paper tape',

  'lang.label': 'Interface language',
  'theme.label': 'Theme',
  'theme.system': 'auto',
  'theme.light': 'light',
  'theme.dark': 'dark',
  'shortcuts.open': 'Keys',

  'machine.label': 'Calculator',
  'display.label': 'Display',
  'keypad.label': 'Calculator keypad',
  'key.clear': 'Clear',
  'key.parens': 'Parenthesis',
  'key.percent': 'Percent',
  'key.divide': 'Divide',
  'key.multiply': 'Multiply',
  'key.subtract': 'Subtract',
  'key.add': 'Add',
  'key.point': 'Decimal point',
  'key.backspace': 'Delete',
  'key.equals': 'Equals',

  'tape.title': 'Tape',
  'tape.copy': 'Copy',
  'tape.clear': 'Clear',
  'tape.entryHint': 'Press to use this result in a calculation',
  'tape.insert': 'use',
  'tape.emptyTitle': 'Every calculation is printed here',
  'tape.emptyText': 'Press a result to keep working with it. Try one:',
  'example.exact': 'exactly 0.3, no binary rounding error',
  'example.percent': 'a 15% discount: the percentage is of the amount',
  'example.rounded': '≈ means the result is rounded',

  'footer.facts': 'Decimal arithmetic: 34 significant digits, rounding half to even.',
  'footer.source': 'Source code',

  'error.divisionByZero': 'Can’t divide by zero',
  'error.overflow': 'The number is too large',
  'error.incomplete': 'The expression isn’t finished',
  'error.tooComplex': 'The expression is too complex',
  'error.unreadable': 'Can’t read this expression',

  'paste.unexpectedCharacter': 'Not pasted: unknown character “{value}”',
  'paste.ambiguousNumber': 'Not pasted: unclear decimal separator in “{value}”',
  'paste.tooLong': 'Not pasted: the text is too long',

  'toast.copied': 'Copied: {value}',
  'toast.tapeCopied': 'Tape copied',
  'toast.tapeEmpty': 'The tape is empty',
  'toast.tapeCleared': 'Tape cleared',
  'toast.undo': 'Undo',
  'toast.copyFailed': 'Couldn’t copy: the browser denied clipboard access',
  'toast.noStorage': 'The tape won’t be saved: this browser blocks storage',
  'toast.crash': 'Something went wrong. Reload the page — your tape is saved.',

  'announce.result': 'Result: {value}',
  'announce.approximate': 'Result, approximately: {value}',
  'number.power': '{mantissa} times 10 to the power of {exponent}',

  'shortcuts.title': 'Keyboard',
  'shortcuts.digits': 'digits, decimal point or comma',
  'shortcuts.operators': 'add, subtract, multiply, divide',
  'shortcuts.parens': 'parentheses and percent',
  'shortcuts.equals': 'calculate',
  'shortcuts.backspace': 'delete the last character',
  'shortcuts.clear': 'clear the expression',
  'shortcuts.copy': 'copy the result',
  'shortcuts.paste': 'paste an expression',
  'shortcuts.or': 'or',
  'shortcuts.close': 'Close',

  noscript: 'The calculator needs JavaScript. Please turn it on in your browser settings.',
};

const MESSAGES: Readonly<Record<Locale, Readonly<Record<MessageKey, string>>>> = { ru, en };

export const LOCALES: readonly Locale[] = ['ru', 'en'];

export type Translate = (key: MessageKey, params?: Readonly<Record<string, string>>) => string;

export function translator(locale: Locale): Translate {
  const messages = MESSAGES[locale];
  return (key, params) =>
    messages[key].replace(/\{(\w+)\}/g, (match, name: string) => params?.[name] ?? match);
}

export function isMessageKey(key: unknown): key is MessageKey {
  return typeof key === 'string' && Object.hasOwn(ru, key);
}

export function isLocale(value: unknown): value is Locale {
  return value === 'ru' || value === 'en';
}

/**
 * Picks the interface language: an explicit `?lang=` in the address first,
 * then the saved choice, then the first Russian or English entry among the
 * browser languages. Everyone else gets English.
 */
export function detectLocale(
  search: string,
  saved: string | null,
  browserLanguages: readonly string[],
): Locale {
  const fromQuery = new URLSearchParams(search).get('lang');
  if (isLocale(fromQuery)) return fromQuery;
  if (isLocale(saved)) return saved;
  for (const tag of browserLanguages) {
    const language = tag.toLowerCase().split('-')[0];
    if (language === 'ru') return 'ru';
    if (language === 'en') return 'en';
  }
  return 'en';
}

const ERROR_MESSAGES: Readonly<Record<CalcErrorCode, MessageKey>> = {
  divisionByZero: 'error.divisionByZero',
  overflow: 'error.overflow',
  incomplete: 'error.incomplete',
  tooComplex: 'error.tooComplex',
  empty: 'error.unreadable',
  unexpectedToken: 'error.unreadable',
  unexpectedCharacter: 'error.unreadable',
  unclosedParen: 'error.unreadable',
};

export function errorMessageKey(code: CalcErrorCode): MessageKey {
  return ERROR_MESSAGES[code];
}
