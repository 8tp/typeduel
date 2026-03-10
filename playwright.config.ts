import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: [
    {
      command: 'DISCONNECT_GRACE_MS=2000 npm run --workspace=packages/server dev',
      port: 3001,
      reuseExistingServer: true,
      timeout: 15000,
    },
    {
      command: 'npm run --workspace=packages/client dev',
      port: 5173,
      reuseExistingServer: true,
      timeout: 15000,
    },
  ],
})
