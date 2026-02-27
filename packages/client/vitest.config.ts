import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@microchat/crypto': resolve(__dirname, '../crypto/src/index.ts'),
      '@microchat/shared': resolve(__dirname, '../shared/src/index.ts'),
    },
  },
});
