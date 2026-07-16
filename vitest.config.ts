import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**'],
    coverage: {
      provider: 'v8',
      all: true,
      // 覆蓋率只量純邏輯模組；React hook/元件（useTable、*.tsx）由 e2e 驗證
      include: [
        'src/engine/**/*.ts',
        'src/cpu/**/*.ts',
        'src/storage/**/*.ts',
        'src/review/**/*.ts',
        'src/stats/**/*.ts',
        'src/features/table/session.ts',
      ],
      exclude: ['**/*.test.ts'],
      thresholds: { lines: 85, functions: 85, branches: 85, statements: 85 },
    },
  },
});
