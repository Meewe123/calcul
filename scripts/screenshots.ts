/**
 * Captures the README screenshots and the demo GIF from a production build,
 * with real calculations, so they always show the current design:
 *
 *   docs/screenshots/desktop-light.png, desktop-dark.png
 *   docs/screenshots/phone-light.png, phone-dark.png
 *   docs/screenshots/demo.gif   (needs ImageMagick)
 *
 * Run: npm run build && npm run screenshots
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';
import { preview } from 'vite';

const OUT = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
const PORT = 4175;
const URL_ROOT = `http://localhost:${PORT}/`;

interface Shot {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly dark: boolean;
  readonly locale: string;
}

const SHOTS: readonly Shot[] = [
  { name: 'desktop-light', width: 1280, height: 800, dark: false, locale: 'ru-RU' },
  { name: 'desktop-dark', width: 1280, height: 800, dark: true, locale: 'en-US' },
  { name: 'phone-light', width: 360, height: 740, dark: false, locale: 'ru-RU' },
  { name: 'phone-dark', width: 360, height: 740, dark: true, locale: 'en-US' },
];

async function calculate(page: Page, expression: string): Promise<void> {
  await page.keyboard.type(expression);
  await page.keyboard.press('Enter');
}

/** A short, real session: the three examples' ideas plus a calculation in progress. */
async function fillTape(page: Page): Promise<void> {
  await page.locator('[data-example]').first().click();
  await calculate(page, '1200-15%');
  await calculate(page, '1/3');
  await calculate(page, '12345*(3+4');
  await page.keyboard.type('+15%');
  await page.mouse.move(0, 0);
}

async function captureStill(browser: Browser, shot: Shot): Promise<void> {
  const context = await browser.newContext({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: 2,
    colorScheme: shot.dark ? 'dark' : 'light',
    locale: shot.locale,
  });
  const page = await context.newPage();
  await page.goto(URL_ROOT);
  await fillTape(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(OUT, `${shot.name}.png`) });
  await context.close();
}

/** Frames of a typical session, assembled into a looping GIF. */
async function captureDemo(browser: Browser): Promise<void> {
  const frames = mkdtempSync(join(tmpdir(), 'calcul-frames-'));
  const context = await browser.newContext({
    viewport: { width: 960, height: 600 },
    colorScheme: 'light',
    locale: 'ru-RU',
  });
  const page = await context.newPage();
  await page.goto(URL_ROOT);
  await page.evaluate(() => document.fonts.ready);

  const delays: number[] = [];
  const frame = async (hundredths: number): Promise<void> => {
    await page.waitForTimeout(260); // let the print animation finish
    const index = String(delays.length).padStart(3, '0');
    await page.screenshot({ path: join(frames, `${index}.png`) });
    delays.push(hundredths);
  };
  const typeSlowly = async (text: string): Promise<void> => {
    for (const char of text) {
      await page.keyboard.type(char);
      await frame(12);
    }
  };

  await frame(150);
  await page.locator('[data-example]').first().click();
  await frame(200);
  await typeSlowly('1200-15%');
  await frame(80);
  await page.keyboard.press('Enter');
  await frame(200);
  await typeSlowly('1/3');
  await page.keyboard.press('Enter');
  await frame(220);
  await typeSlowly('2*');
  await page.locator('.entry').nth(1).hover();
  await frame(100);
  await page.locator('.entry').nth(1).click();
  await frame(150);
  await page.keyboard.press('Enter');
  await page.mouse.move(0, 0);
  await frame(400);
  await context.close();

  const args = delays.flatMap((delay, i) => [
    '-delay',
    String(delay),
    join(frames, `${String(i).padStart(3, '0')}.png`),
  ]);
  execFileSync('convert', ['-loop', '0', ...args, '-layers', 'Optimize', join(OUT, 'demo.gif')]);
  rmSync(frames, { recursive: true });
}

mkdirSync(OUT, { recursive: true });
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'warn' });
const browser = await chromium.launch(
  process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
);
try {
  for (const shot of SHOTS) await captureStill(browser, shot);
  await captureDemo(browser);
  console.log(`Screenshots written to ${OUT}`);
} finally {
  await browser.close();
  await server.close();
}
