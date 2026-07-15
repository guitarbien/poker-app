import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**'],
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/engine/**/*.ts', 'src/cpu/**/*.ts', 'src/features/table/session.ts'],
      exclude: ['**/*.test.ts'],
      thresholds: { lines: 85, functions: 85, branches: 85, statements: 85 },
    },
  },
});
