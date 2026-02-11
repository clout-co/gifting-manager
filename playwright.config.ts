import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load local env for DB access in tests (Supabase URL/keys live in .env.local).
dotenv.config({ path: '.env.local' });

const PORT = Number(process.env.E2E_PORT || 3010);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `NEXT_PUBLIC_E2E=true SSO_BYPASS=true npm run dev -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

