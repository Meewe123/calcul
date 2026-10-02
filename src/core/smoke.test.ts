import { expect, test } from 'vitest';

test('toolchain runs', () => {
  expect(10n ** 3n).toBe(1000n);
});
