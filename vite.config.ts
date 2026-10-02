import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const DEFAULT_SITE_URL = 'https://meewe123.github.io/calcul/';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const siteUrl = withTrailingSlash(env.SITE_URL ?? DEFAULT_SITE_URL);

  return {
    base: env.BASE_PATH ?? '/',
    // No client-side routing: unknown paths get 404.html, as on GitHub Pages.
    appType: 'mpa',
    resolve: {
      alias: {
        '@fonts': fileURLToPath(new URL('./node_modules/@fontsource', import.meta.url)),
      },
    },
    plugins: [
      siteUrlPlugin(siteUrl),
      crawlerFilesPlugin(siteUrl),
      securityPlugin(),
      notFoundPreviewPlugin(),
    ],
    build: {
      target: 'es2022',
      // Every browser that runs ES2022 supports <link rel="modulepreload">.
      modulePreload: { polyfill: false },
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL('./index.html', import.meta.url)),
          notFound: fileURLToPath(new URL('./404.html', import.meta.url)),
        },
      },
    },
    test: {
      include: ['src/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        include: ['src/core/**/*.ts'],
        exclude: ['src/**/*.test.ts'],
        thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 },
      },
    },
  };
});

function withTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

/** Replaces %SITE_URL% in HTML with the public address (canonical and Open Graph links). */
function siteUrlPlugin(siteUrl: string): Plugin {
  return {
    name: 'calcul:site-url',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', siteUrl),
  };
}

/** Writes robots.txt and sitemap.xml with the public address. */
function crawlerFilesPlugin(siteUrl: string): Plugin {
  return {
    name: 'calcul:crawler-files',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`,
      });
      // One address: the language is picked on the page, so there is nothing else to index.
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${siteUrl}</loc></url>\n</urlset>\n`,
      });
    },
  };
}

/**
 * Adds a Content Security Policy to built pages. GitHub Pages cannot send
 * headers, so it goes into a <meta> tag. Inline scripts (the theme snippet
 * that must run before first paint) are allowed by their SHA-256 hash, so
 * no other inline script can run. Only applied to production builds:
 * the dev server needs inline scripts for hot reload.
 */
function securityPlugin(): Plugin {
  return {
    name: 'calcul:security',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
          ([, body = '']) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`,
        );
        const policy = [
          "default-src 'self'",
          `script-src 'self' ${hashes.join(' ')}`.trim(),
          "style-src 'self'",
          "font-src 'self'",
          "img-src 'self' data:",
          "manifest-src 'self'",
          "connect-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; ');
        return html.replace(
          '<meta charset="utf-8" />',
          `<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />\n    <meta name="referrer" content="strict-origin-when-cross-origin" />`,
        );
      },
    },
  };
}

/**
 * `vite preview` answers unknown paths with an empty 404. GitHub Pages
 * serves 404.html instead; doing the same locally lets the end-to-end
 * tests check the real page.
 */
function notFoundPreviewPlugin(): Plugin {
  return {
    name: 'calcul:not-found-preview',
    configurePreviewServer(server) {
      return () => {
        server.middlewares.use((request, response, next) => {
          const outDir = resolve(server.config.root, server.config.build.outDir);
          const path = new URL(request.url ?? '/', 'http://localhost').pathname;
          // Pages that exist are served by Vite after this middleware.
          const isPage = [`${path}/index.html`, `${path}.html`, path].some(
            (candidate) =>
              candidate.endsWith('.html') && existsSync(resolve(outDir, `.${candidate}`)),
          );
          if (
            request.method !== 'GET' ||
            isPage ||
            !request.headers.accept?.includes('text/html')
          ) {
            next();
            return;
          }
          readFile(resolve(outDir, '404.html'), 'utf8').then(
            (html) => {
              response.statusCode = 404;
              response.setHeader('Content-Type', 'text/html; charset=utf-8');
              response.end(html);
            },
            () => {
              next();
            },
          );
        });
      };
    },
  };
}
