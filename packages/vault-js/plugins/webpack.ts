/**
 * @fileoverview Webpack Plugin for P47H Vault WASM
 * 
 * Automatically handles WASM module loading in Webpack projects.
 * Copies WASM files to output directory and configures optimal loading.
 * 
 * @module plugins/webpack
 * @license Apache-2.0 OR Commercial
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Compiler, Compilation, sources as WebpackSources } from 'webpack';

// Webpack 5 Compilation.PROCESS_ASSETS_STAGE_ADDITIONS = 1000
const PROCESS_ASSETS_STAGE_ADDITIONS = 1000;

export interface P47hWebpackPluginOptions {
  /**
   * Output directory for WASM files (relative to output.path)
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
 * Webpack plugin for P47H Vault WASM integration.
 * 
 * @example
 * ```javascript
 * // webpack.config.js
 * const { P47hWebpackPlugin } = require('@p47h/vault-js/plugins/webpack');
 * 
 * module.exports = {
 *   plugins: [
 *     new P47hWebpackPlugin({
 *       wasmDir: 'wasm',
 *       inline: false
 *     })
 *   ],
 *   experiments: {
 *     asyncWebAssembly: true
 *   }
 * };
 * ```
 */
export class P47hWebpackPlugin {
  private options: Required<P47hWebpackPluginOptions>;

  constructor(options: P47hWebpackPluginOptions = {}) {
    this.options = {
      wasmDir: options.wasmDir ?? 'wasm',
      inline: options.inline ?? false,
      wasmSource: options.wasmSource ?? 'node_modules/@p47h/vault-js/wasm'
    };
  }

  apply(compiler: Compiler): void {
    const pluginName = 'P47hWebpackPlugin';
    const { wasmDir, inline, wasmSource } = this.options;

    // Get context (project root)
    const context = compiler.options.context || process.cwd();

    if (inline) {
      // Inline mode: Generate a virtual module with embedded WASM
      compiler.hooks.compilation.tap(pluginName, (compilation: Compilation) => {
        compilation.hooks.processAssets.tap(
          {
            name: pluginName,
            stage: PROCESS_ASSETS_STAGE_ADDITIONS
          },
          () => {
            const wasmPath = path.resolve(context, wasmSource, 'p47h_wasm_core_bg.wasm');
            
            if (!fs.existsSync(wasmPath)) {
              compilation.warnings.push(
                new Error(`[${pluginName}] WASM file not found at ${wasmPath}`)
              );
              return;
            }

            const wasmBuffer = fs.readFileSync(wasmPath);
            const base64 = wasmBuffer.toString('base64');

            // Emit inlined WASM module
            const inlineModule = `
              // Auto-generated inline WASM module by P47hWebpackPlugin
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

            compilation.emitAsset(
              'p47h-wasm-inline.js',
              new compiler.webpack.sources.RawSource(inlineModule)
            );

            console.log(`[${pluginName}] Generated inline WASM module`);
          }
        );
      });
    } else {
      // Copy mode: Copy WASM files to output directory
      compiler.hooks.afterEmit.tapAsync(pluginName, (compilation: Compilation, callback: () => void) => {
        const outputPath = compilation.outputOptions.path || path.resolve(context, 'dist');
        const sourcePath = path.resolve(context, wasmSource);
        const destPath = path.join(outputPath, wasmDir);

        if (!fs.existsSync(sourcePath)) {
          console.warn(`[${pluginName}] WASM source not found at ${sourcePath}`);
          callback();
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
            console.log(`[${pluginName}] Copied ${file} to ${destPath}`);
          }
        }

        callback();
      });
    }

    // Add WASM support to webpack config
    compiler.hooks.environment.tap(pluginName, () => {
      if (!compiler.options.experiments) {
        compiler.options.experiments = {};
      }
      compiler.options.experiments.asyncWebAssembly = true;
    });
  }
}

export default P47hWebpackPlugin;
