import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3456,
  },
  resolve: {
    alias: {
      // Link to local built packages (relative paths from the example dir).
      // Both live under packages/: vault-react is ../dist, vault-js is ../../vault-js/dist.
      '@p47h/vault-react': new URL('../dist/index.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
      '@p47h/vault-js': new URL('../../vault-js/dist/index.js', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
    },
  },
  assetsInclude: ['**/*.wasm'],
});
