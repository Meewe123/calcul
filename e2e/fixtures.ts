import { test as base, expect, type Locator, type Page } from '@playwright/test';

/** Fails any test that logs a console error or throws: that includes CSP violations. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      // A navigation to a missing page is a 404 on purpose; Chrome still logs it.
      const missingPages = new Set<string>();
      page.on('response', (response) => {
        if (response.request().isNavigationRequest() && response.status() === 404) {
          missingPages.add(response.url());
        }
      });
      page.on('console', (message) => {
        if (message.type() !== 'error') return;
        if (missingPages.has(message.location().url)) return;
        errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await use(errors);
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Text with every kind of space (thin, narrow, no-break) collapsed to one ordinary space. */
export function normalize(text: string | null): string {
  return (text ?? '').replace(/[\s\u00a0\u2009\u202f]+/g, ' ').trim();
}

export async function textOf(locator: Locator): Promise<string> {
  return normalize(await locator.textContent());
}

export const display = (page: Page) => ({
  meta: page.locator('#display-meta'),
  main: page.locator('#display-main'),
  hint: page.locator('#display-hint'),
});

const KEYPAD: Record<string, string> = {
  '=': '[data-action="evaluate"]',
  C: '[data-action="clear"]',
  '⌫': '[data-key="backspace"]',
  '(': '[data-key="()"]',
  ')': '[data-key="()"]',
};

/** Presses on-screen keys: `"2+3*4="`, `C` clears, `⌫` erases. */
export async function tapKeys(page: Page, keys: string): Promise<void> {
  for (const char of keys) {
    await page.locator(`.keypad ${KEYPAD[char] ?? `[data-key="${char}"]`}`).click();
  }
}

/** Types on the physical keyboard and presses Enter. */
export async function calculate(page: Page, expression: string): Promise<void> {
  await page.keyboard.type(expression);
  await page.keyboard.press('Enter');
}

export async function paste(page: Page, text: string): Promise<void> {
  await page.evaluate((value) => {
    const data = new DataTransfer();
    data.setData('text/plain', value);
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
  }, text);
}
