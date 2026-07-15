import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts', 'src/cpu/**/*.ts'],
      exclude: ['src/engine/**/*.test.ts', 'src/cpu/**/*.test.ts'],
      thresholds: { lines: 85, functions: 85, branches: 85, statements: 85 },
    },
  },
});
