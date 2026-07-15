import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  // 用專屬埠 + strictPort：5173 常被使用者其他 vite 專案佔用（實測踩到，
  // reuseExistingServer 會誤打到別人的 app），故不共用、不重用
  use: { baseURL: 'http://localhost:5199' },
  webServer: { command: 'npm run dev -- --port 5199 --strictPort', url: 'http://localhost:5199', reuseExistingServer: false },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone SE'], browserName: 'chromium' } },
  ],
});
