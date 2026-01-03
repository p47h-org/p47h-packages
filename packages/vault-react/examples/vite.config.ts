import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3456,
  },
  resolve: {
    alias: {
      // Link to local built packages (relative paths from project root)
      '@p47h/vault-react': new URL('../dist/index.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
      '@p47h/vault-js': new URL('../../../p47h-vault-js/dist/index.js', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
    },
  },
  assetsInclude: ['**/*.wasm'],
});
