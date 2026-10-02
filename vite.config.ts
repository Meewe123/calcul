import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: env.BASE_PATH ?? '/',
    build: {
      target: 'es2022',
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
