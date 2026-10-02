import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { calculate, expect, test } from './fixtures';

async function expectNoViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}

test('empty calculator', async ({ page }) => {
  await page.goto('/');
  await expectNoViolations(page);
});

test('tape, result and error, light and dark', async ({ page }) => {
  await page.goto('/');
  await calculate(page, '1200-15%');
  await calculate(page, '1/3');
  await calculate(page, '10/0');
  await expectNoViolations(page);

  await page.locator('#theme-toggle').click();
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expectNoViolations(page);
});

test('English', async ({ page }) => {
  await page.goto('/?lang=en');
  await calculate(page, '2+2');
  await expectNoViolations(page);
});

test('shortcuts dialog', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The shortcuts button is hidden on phones');
  await page.goto('/');
  await page.locator('#shortcuts-open').click();
  await expectNoViolations(page);
});

test('404 page', async ({ page }) => {
  await page.goto('/missing');
  await expectNoViolations(page);
});

test('results are announced to screen readers', async ({ page }) => {
  await page.goto('/');
  await calculate(page, '6*7');
  await expect(page.locator('#announcer')).toHaveText('Результат: 42');
  await calculate(page, '1/0');
  await expect(page.locator('#announcer')).toHaveText('На ноль делить нельзя');
});
