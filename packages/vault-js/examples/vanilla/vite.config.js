import { defineConfig } from 'vite';
import { p47hVaultPlugin } from '@p47h/vault-js/plugins/vite';

// The official @p47h/vault-js plugin serves the Rust/WASM crypto core to the dev
// server and the build. No manual WASM copying.
export default defineConfig({
  plugins: [p47hVaultPlugin()],
  server: { port: 3457 },
});
