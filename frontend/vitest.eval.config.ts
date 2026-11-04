import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import path from 'node:path';

// Évaluation MANUELLE de la recherche (appels Jev payants) : jamais en CI.
export default defineConfig(({ mode }) => ({
  test: {
    environment: 'node',
    include: ['lib/recherche/evaluation/**/*.eval.ts'],
    env: loadEnv(mode, process.cwd(), ''),
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  esbuild: { jsx: 'automatic' },
}));
