import { defineConfig } from 'vitest/config';

// Vitest configuration for Backend Node.js service
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
    include: ['tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://localhost:27017/devpulse_test',
      JWT_SECRET: 'devpulse_test_jwt_secret_key_super_secure_32_chars',
      JWT_EXPIRES_IN: '15m',
      JWT_REFRESH_SECRET: 'devpulse_test_jwt_refresh_secret_key_super_secure_32_chars',
      JWT_REFRESH_EXPIRES_IN: '7d',
    },
  },
});
