import { describe, expect, test } from 'vitest';
import type { TapeEntry } from './calculator';
import { entryToText, parseTape, serializeTape, tapeToText } from './tape';

const NB = String.fromCharCode(0x202f);

const entries: TapeEntry[] = [
  { id: 1, source: '0.1+0.2', result: '0.3', exact: true },
  { id: 2, source: '1/3', result: '0.' + '3'.repeat(34), exact: false },
  { id: 3, source: '1200-15%', result: '1020', exact: true },
];

describe('storage', () => {
  test('round-trips', () => {
    expect(parseTape(serializeTape(entries))).toEqual(entries);
  });

  test.each([
    null,
    '',
    'not json',
    '[]',
    '{"version":2,"entries":[]}',
    '{"version":1}',
    '{"version":1,"entries":{}}',
  ])('unreadable data %j gives an empty tape', (json) => {
    expect(parseTape(json)).toEqual([]);
  });

  test('drops entries that do not look right and keeps the rest', () => {
    const json = JSON.stringify({
      version: 1,
      entries: [
        entries[0],
        { id: 2, source: 'alert(1)', result: '1', exact: true },
        { id: 3, source: '1+1', result: 'NaN', exact: true },
        { id: -1, source: '1+1', result: '2', exact: true },
        { id: 4, source: '1+1', result: '2' },
        null,
        'text',
        { ...entries[0] },
        entries[2],
      ],
    });
    expect(parseTape(json)).toEqual([entries[0], entries[2]]);
  });
});

describe('copying', () => {
  test('one line per calculation, ≈ for rounded results', () => {
    expect(tapeToText(entries, 'ru')).toBe(
      ['0,1 + 0,2 = 0,3', '1 ÷ 3 ≈ 0,3333333333333333', `1${NB}200 − 15% = 1${NB}020`].join('\n'),
    );
  });

  test('uses the English separators in English', () => {
    expect(entryToText({ id: 1, source: '1234.5*2', result: '2469', exact: true }, 'en')).toBe(
      '1,234.5 × 2 = 2,469',
    );
  });
});
