/**
 * Saving, loading and copying the tape. Stored data is treated as untrusted:
 * it may be from an older version, edited by hand, or cut off by a full disk.
 */
import { MAX_TAPE_ENTRIES, type TapeEntry } from './calculator';
import { parseDecimal } from './decimal';
import { MAX_SOURCE_LENGTH } from './evaluate';
import {
  expressionToText,
  formatDecimal,
  formatExpression,
  numberToText,
  type Locale,
} from './format';
import { tokenize } from './lexer';

const STORAGE_VERSION = 1;

interface StoredTape {
  readonly version: typeof STORAGE_VERSION;
  readonly entries: readonly TapeEntry[];
}

export function serializeTape(tape: readonly TapeEntry[]): string {
  const stored: StoredTape = { version: STORAGE_VERSION, entries: tape };
  return JSON.stringify(stored);
}

/** Reads a stored tape. Invalid entries are dropped; unreadable data gives an empty tape. */
export function parseTape(json: string | null): TapeEntry[] {
  if (!json) return [];
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  if (!isRecord(data) || data.version !== STORAGE_VERSION || !Array.isArray(data.entries)) {
    return [];
  }
  const entries: TapeEntry[] = [];
  const seen = new Set<number>();
  for (const item of data.entries.slice(-MAX_TAPE_ENTRIES)) {
    const entry = toEntry(item);
    if (entry && !seen.has(entry.id)) {
      seen.add(entry.id);
      entries.push(entry);
    }
  }
  return entries;
}

function toEntry(item: unknown): TapeEntry | null {
  if (!isRecord(item)) return null;
  const { id, source, result, exact } = item;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) return null;
  if (typeof source !== 'string' || source.length === 0 || source.length > MAX_SOURCE_LENGTH) {
    return null;
  }
  if (typeof result !== 'string' || typeof exact !== 'boolean') return null;
  try {
    tokenize(source);
    parseDecimal(result);
  } catch {
    return null;
  }
  return { id, source, result, exact };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** One entry as a line of text: `0,1 + 0,2 = 0,3`, or `≈` when rounded. */
export function entryToText(entry: TapeEntry, locale: Locale): string {
  const expression = expressionToText(formatExpression(entry.source, locale), locale);
  const result = formatDecimal(parseDecimal(entry.result), locale);
  const sign = entry.exact && !result.rounded ? '=' : '≈';
  return `${expression} ${sign} ${numberToText(result, locale)}`;
}

/** The whole tape as plain text, oldest first, for the clipboard. */
export function tapeToText(tape: readonly TapeEntry[], locale: Locale): string {
  return tape.map((entry) => entryToText(entry, locale)).join('\n');
}
