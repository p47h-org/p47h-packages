import { defineConfig } from 'tsup';

/**
 * tsup configuration for P47H Vault JS SDK
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  target: 'es2020',
  platform: 'browser',
  treeshake: true,
  outDir: 'dist',
  external: [
    './wasm/p47h_wasm_core.js',
    '../../wasm/p47h_wasm_core.js',
  ],
  banner: {
    js: `/**
 * P47H Vault JS - Secure local-first cryptographic storage
 * @license Apache-2.0 OR Commercial (https://p47h.com/licensing)
 */`,
  },
});