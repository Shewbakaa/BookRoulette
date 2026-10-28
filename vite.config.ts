import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/BookRoulette/',
  test: {
    environment: 'jsdom',
  },
});
