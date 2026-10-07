import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts', 'lib/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  // JSX automatique, comme Next.js : sans lui, un composant .tsx importé par un
  // test échoue sur « React is not defined ».
  esbuild: { jsx: 'automatic' },
});
