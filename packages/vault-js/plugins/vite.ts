/**
 * @fileoverview Vite Plugin for P47H Vault WASM
 * 
 * Automatically handles WASM module loading in Vite projects.
 * Copies WASM files to public directory and configures optimal loading.
 * 
 * @module plugins/vite
 * @license Apache-2.0 OR Commercial
 */

import { Plugin } from 'vite';
import * as fs from 'fs';
import * as path from 'path';

export interface P47hVitePluginOptions {
  /**
   * Output directory for WASM files (relative to public directory)
   * @default 'wasm'
   */
  wasmDir?: string;
  
  /**
   * Enable inline WASM as base64 (increases bundle size ~33%)
   * @default false
   */
  inline?: boolean;
  
  /**
   * Path to WASM source files
   * @default 'node_modules/@p47h/vault-js/wasm'
   */
  wasmSource?: string;
}

/**
 * Vite plugin for P47H Vault WASM integration.
 * 
 * @example
 * ```typescript
 * // vite.config.ts
 * import { defineConfig } from 'vite';
 * import { p47hVaultPlugin } from '@p47h/vault-js/plugins/vite';
 * 
 * export default defineConfig({
 *   plugins: [
 *     p47hVaultPlugin({
 *       wasmDir: 'wasm',  // Output to public/wasm/
 *       inline: false     // Don't inline (use fetch)
 *     })
 *   ]
 * });
 * ```
 */
export function p47hVaultPlugin(options: P47hVitePluginOptions = {}): Plugin {
  const {
    wasmDir = 'wasm',
    inline = false,
    wasmSource = 'node_modules/@p47h/vault-js/wasm'
  } = options;

  let publicDir: string;
  let rootDir: string;

  return {
    name: 'p47h-vault-wasm',
    
    configResolved(config) {
      rootDir = config.root;
      publicDir = config.publicDir || path.join(rootDir, 'public');
    },

    buildStart() {
      if (inline) {
        // Inline mode: WASM will be embedded, no copy needed
        console.log('[p47h-vault] Using inline WASM mode');
        return;
      }

      // Copy WASM files to public directory
      const sourcePath = path.resolve(rootDir, wasmSource);
      const destPath = path.join(publicDir, wasmDir);

      if (!fs.existsSync(sourcePath)) {
        this.warn(`WASM source not found at ${sourcePath}. Run 'npm install' first.`);
        return;
      }

      // Ensure destination directory exists
      fs.mkdirSync(destPath, { recursive: true });

      // Copy WASM files
      const wasmFiles = [
        'p47h_wasm_core.js',
        'p47h_wasm_core_bg.wasm'
      ];

      for (const file of wasmFiles) {
        const src = path.join(sourcePath, file);
        const dest = path.join(destPath, file);
        
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
          console.log(`[p47h-vault] Copied ${file} to ${destPath}`);
        }
      }
    },

    resolveId(id) {
      // Handle virtual module for inline WASM
      if (inline && id === 'virtual:p47h-wasm-inline') {
        return id;
      }
      return null;
    },

    load(id) {
      // Generate inline WASM module
      if (inline && id === 'virtual:p47h-wasm-inline') {
        const wasmPath = path.resolve(rootDir, wasmSource, 'p47h_wasm_core_bg.wasm');
        
        if (!fs.existsSync(wasmPath)) {
          this.error(`WASM file not found at ${wasmPath}`);
          return null;
        }

        const wasmBuffer = fs.readFileSync(wasmPath);
        const base64 = wasmBuffer.toString('base64');

        return `
          // Auto-generated inline WASM module
          const WASM_BASE64 = "${base64}";
          
          export async function loadInlineWasm() {
            const binaryString = atob(WASM_BASE64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            return WebAssembly.compile(bytes);
          }
          
          export const wasmBase64 = WASM_BASE64;
        `;
      }
      return null;
    },

    // Inject configuration for the SDK
    transform(code, id) {
      if (id.includes('@p47h/vault-js') && id.endsWith('WasmCryptoAdapter.ts')) {
        // Inject the configured WASM path
        const wasmPath = inline ? '__INLINE__' : `/${wasmDir}/p47h_wasm_core_bg.wasm`;
        return code.replace(
          /private readonly _wasmPath: string = '[^']*'/,
          `private readonly _wasmPath: string = '${wasmPath}'`
        );
      }
      return null;
    }
  };
}

export default p47hVaultPlugin;
