import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Caminhos relativos para funcionar em subpastas de deploy (ex.: *.dev.pixellab.run).
  base: './',
  server: {
    port: 5173,
    // Os artistas gravam PNGs em public/assets enquanto o servidor roda; no Windows o watcher
    // falha com EBUSY e derruba o Vite. Assets novos aparecem com Ctrl+F5.
    watch: { ignored: ['**/public/assets/**'] },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
