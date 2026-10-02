import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const DEFAULT_SITE_URL = 'https://meewe123.github.io/calcul/';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const siteUrl = withTrailingSlash(env.SITE_URL ?? DEFAULT_SITE_URL);

  return {
    base: env.BASE_PATH ?? '/',
    resolve: {
      alias: {
        '@fonts': fileURLToPath(new URL('./node_modules/@fontsource', import.meta.url)),
      },
    },
    plugins: [siteUrlPlugin(siteUrl), securityPlugin()],
    build: {
      target: 'es2022',
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
