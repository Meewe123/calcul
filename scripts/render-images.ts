/**
 * Renders the raster images in public/ from their sources, so they can be
 * regenerated after a design change instead of being edited by hand:
 *
 *   public/og.png               ← scripts/og-card.html  (Open Graph preview)
 *   public/icon-192.png, -512   ← scripts/icon.svg      (web app manifest)
 *   public/apple-touch-icon.png ← scripts/icon.svg
 *   public/favicon.ico          ← public/favicon.svg    (needs ImageMagick)
 *
 * Run: npm run images   (PW_CHROMIUM_PATH can point to a local Chromium)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = (path: string): string => fileURLToPath(new URL(`../${path}`, import.meta.url));

const browser = await chromium.launch(
  process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
);

const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await og.goto(`file://${root('scripts/og-card.html')}`);
await og.evaluate(() => document.fonts.ready);
await og.screenshot({ path: root('public/og.png') });

async function renderSvg(svgPath: string, size: number, out: string): Promise<void> {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const svg = readFileSync(root(svgPath), 'utf8');
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({ path: root(out), omitBackground: true });
  await page.close();
}

await renderSvg('scripts/icon.svg', 192, 'public/icon-192.png');
await renderSvg('scripts/icon.svg', 512, 'public/icon-512.png');
await renderSvg('scripts/icon.svg', 180, 'public/apple-touch-icon.png');
await renderSvg('public/favicon.svg', 32, 'scripts/.favicon-32.png');
await browser.close();

execFileSync('convert', [root('scripts/.favicon-32.png'), root('public/favicon.ico')]);
execFileSync('rm', [root('scripts/.favicon-32.png')]);
console.log('Images written to public/');
