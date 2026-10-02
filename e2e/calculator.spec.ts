import { calculate, display, expect, paste, tapKeys, test, textOf } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('calculating', () => {
  test('on-screen keys follow operator precedence and print to the tape', async ({ page }) => {
    await tapKeys(page, '2+3*4=');
    expect(await textOf(display(page).main)).toBe('14');
    expect(await textOf(display(page).meta)).toBe('2 + 3 × 4 =');
    const entry = page.locator('.entry').first();
    expect(await textOf(entry.locator('.entry__expression'))).toBe('2 + 3 × 4');
    expect(await textOf(entry.locator('.entry__result'))).toBe('= 14');
  });

  test('keeps every digit (the precision bug from the audit)', async ({ page }) => {
    await calculate(page, '123456789012345+1');
    expect(await textOf(display(page).main)).toBe('123 456 789 012 346');
  });

  test('0.1 + 0.2 is exactly 0.3, and 1 ÷ 3 is marked as rounded', async ({ page }) => {
    await calculate(page, '0.1+0.2');
    expect(await textOf(display(page).main)).toBe('0,3');
    expect(await textOf(display(page).meta)).toMatch(/=$/);

    await calculate(page, '1/3');
    expect(await textOf(display(page).meta)).toMatch(/≈$/);
    expect(await textOf(page.locator('.entry__sign').last())).toBe('≈');
  });

  test('a percentage after + or − is taken of the amount', async ({ page }) => {
    await calculate(page, '1200-15%');
    expect(await textOf(display(page).main)).toBe('1 020');
  });

  test('shows a live preview and the parentheses still to close', async ({ page }) => {
    await page.keyboard.type('2*(3+4');
    expect(await textOf(display(page).hint)).toBe('= 14');
    await expect(page.locator('#display-main .part--ghost')).toHaveText(')');
  });

  test('an error keeps the expression so it can be fixed', async ({ page }) => {
    await calculate(page, '10/0');
    await expect(display(page).hint).toHaveText('На ноль делить нельзя');
    await expect(page.locator('#display-main .part--error')).toHaveText('0');
    await expect(page.locator('.entry')).toHaveCount(0);

    await page.keyboard.press('Backspace');
    await calculate(page, '4');
    expect(await textOf(display(page).main)).toBe('2,5');
  });

  test('a result carries on into the next calculation', async ({ page }) => {
    await calculate(page, '6*7');
    await page.keyboard.type('+1');
    expect(await textOf(display(page).main)).toBe('42 + 1');
    await page.keyboard.press('Enter');
    expect(await textOf(display(page).main)).toBe('43');
  });

  test('a long number shrinks and scrolls inside the display, never the page', async ({ page }) => {
    await page.keyboard.type('1234567890'.repeat(3) + '+' + '9'.repeat(30));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    const main = display(page).main;
    const scrolledToEnd = await main.evaluate(
      (el) => el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
    );
    expect(scrolledToEnd).toBe(true);
  });
});

test.describe('the tape', () => {
  test('examples on the empty tape run straight away', async ({ page }) => {
    await page.locator('[data-example]').first().click();
    expect(await textOf(display(page).main)).toBe('0,3');
    await expect(page.locator('.entry')).toHaveCount(1);
    await expect(page.locator('#tape-empty')).toBeHidden();
  });

  test('pressing an entry puts its result into the calculation', async ({ page }) => {
    await calculate(page, '6*7');
    await calculate(page, '100+1');
    await page.keyboard.type('2*');
    await page.locator('.entry').first().click();
    expect(await textOf(display(page).main)).toBe('2 × 42');
    await page.keyboard.press('Enter');
    expect(await textOf(display(page).main)).toBe('84');
  });

  test('survives a reload; clearing can be undone', async ({ page }) => {
    await calculate(page, '2+2');
    await page.reload();
    await expect(page.locator('.entry')).toHaveCount(1);

    await page.locator('#tape-clear').click();
    await expect(page.locator('.entry')).toHaveCount(0);
    await expect(page.locator('#tape-empty')).toBeVisible();
    await page.locator('#toast-action').click();
    await expect(page.locator('.entry')).toHaveCount(1);
  });

  test('copies as text, one calculation per line', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Clipboard permissions are Chromium-only in Playwright');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await calculate(page, '2+2');
    await calculate(page, '1/4');
    await page.locator('#tape-copy').click();
    await expect(page.locator('#toast-text')).toHaveText('Лента скопирована');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.split('\n')).toEqual(['2 + 2 = 4', '1 ÷ 4 = 0,25']);
  });
});

test.describe('input', () => {
  test('Enter after clicking keys means =, not "press the last key again"', async ({ page }) => {
    await tapKeys(page, '7+1');
    await page.keyboard.press('Enter');
    expect(await textOf(display(page).main)).toBe('8');
  });

  test('browser shortcuts are left to the browser (the zoom bug from the audit)', async ({
    page,
  }) => {
    await page.keyboard.type('5');
    await page.keyboard.press('Control+-');
    await page.keyboard.press('Control+=');
    expect(await textOf(display(page).main)).toBe('5');
  });

  test('typed keys light up on the keypad', async ({ page }) => {
    await page.keyboard.down('7');
    await expect(page.locator('.keypad [data-key="7"]')).toHaveClass(/is-pressed/);
    await page.keyboard.up('7');
  });

  test('pasting reads an expression, and refuses nonsense with a reason', async ({ page }) => {
    await paste(page, '2 × (3 + 4)');
    expect(await textOf(display(page).main)).toBe('2 × (3 + 4)');

    await page.keyboard.press('Escape');
    await paste(page, '2 + abc');
    await expect(page.locator('#toast-text')).toHaveText('Не вставлено: непонятный символ «a»');
    expect(await textOf(display(page).main)).toBe('0');
  });
});

test.describe('settings', () => {
  test('switches to English and remembers it', async ({ page }) => {
    await page.locator('[data-lang="en"]').click();
    await expect(page).toHaveTitle('calcul — a calculator with a paper tape');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#key-point')).toHaveText('.');
    await calculate(page, '1234.5*2');
    expect(await textOf(display(page).main)).toBe('2,469');

    await page.reload();
    await expect(page.locator('[data-lang="en"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.tape__title')).toHaveText('Tape');
  });

  test('?lang= in the address picks the language', async ({ page }) => {
    await page.goto('/?lang=en');
    await expect(page.locator('.tape__title')).toHaveText('Tape');
  });

  test('theme cycles system → light → dark and survives a reload', async ({ page }) => {
    const html = page.locator('html');
    await expect(html).not.toHaveAttribute('data-theme', /./);
    await page.locator('#theme-toggle').click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await page.locator('#theme-toggle').click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });

  test('keyboard shortcuts open in a dialog that Esc closes', async ({ page, isMobile }) => {
    test.skip(isMobile, 'The shortcuts button is hidden on phones');
    await page.locator('#shortcuts-open').click();
    await expect(page.locator('#shortcuts')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#shortcuts')).toBeHidden();
  });
});

test('unknown addresses get the 404 page', async ({ page }) => {
  const response = await page.goto('/no/such/page');
  expect(response?.status()).toBe(404);
  await expect(page.locator('#lost-path')).toHaveText('/no/such/page');
  await page.locator('.lost__back').click();
  await expect(page.locator('.keypad')).toBeVisible();
});
