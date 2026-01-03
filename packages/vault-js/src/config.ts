/**
 * @fileoverview P47H Vault Configuration
 * 
 * Centralized configuration for WASM loading strategy.
 * This allows users to choose how WASM is loaded at build time.
 * 
 * @module config
 * @license Apache-2.0
 */

/**
 * WASM loading strategy options.
 */
export type WasmStrategy = 
  | 'fetch'       // Default: Fetch from public directory
  | 'inline'      // Embed WASM as base64 in JS bundle
  | 'cdn'         // Load from CDN with local fallback
  | 'custom';     // Custom loading function

/**
 * P47H Vault configuration options.
 */
export interface P47hVaultConfig {
  /**
   * WASM loading strategy.
   * 
   * - `fetch` (default): Fetches WASM from public directory. Best for development
   *   and when you want to keep JS bundle small.
   * 
   * - `inline`: Embeds WASM as base64. No external files needed, but increases
   *   JS bundle by ~33%. Good for restricted environments.
   * 
   * - `cdn`: Loads from CDN with fallback to local. Best performance for 
   *   production with global CDN caching.
   * 
   * - `custom`: Provide your own WASM loading function.
   * 
   * @default 'fetch'
   */
  wasmStrategy?: WasmStrategy;

  /**
   * Path to WASM file (for 'fetch' strategy).
   * @default '/wasm/p47h_wasm_core_bg.wasm'
   */
  wasmPath?: string;

  /**
   * CDN URL for WASM file (for 'cdn' strategy).
   * @default 'https://cdn.p47h.com/wasm/v1.0.1/p47h_wasm_core_bg.wasm'
   */
  cdnUrl?: string;

  /**
   * Custom WASM loader function (for 'custom' strategy).
   */
  customLoader?: () => Promise<WebAssembly.Module>;

  /**
   * Enable debug logging.
   * @default false
   */
  debug?: boolean;
}

import { REQUIRED_CORE_VERSION } from "./version";

/**
 * Default configuration values.
 * The 'fetch' strategy is recommended for most use cases as it:
 * - Keeps JS bundle small
 * - Allows browser-level caching
 * - Works with all bundlers via plugins
 * 
 * NOTE: Version is embedded in filename for cache-busting.
 * When REQUIRED_CORE_VERSION changes, browser gets fresh WASM.
 */
export const defaultConfig: Required<Omit<P47hVaultConfig, 'customLoader'>> = {
  wasmStrategy: 'fetch',
  wasmPath: `/wasm/p47h_vault_free_v${REQUIRED_CORE_VERSION}.wasm`,
  cdnUrl: `https://cdn.p47h.com/wasm/v${REQUIRED_CORE_VERSION}/p47h_vault_free_v${REQUIRED_CORE_VERSION}.wasm`,
  debug: false
};

/**
 * Current configuration instance.
 * Use `configure()` to update.
 */
let currentConfig: P47hVaultConfig = { ...defaultConfig };

/**
 * Configures the P47H Vault SDK.
 * 
 * Call this before initializing the vault to set the WASM loading strategy.
 * 
 * @param config - Configuration options
 * @returns The merged configuration
 * 
 * @example
 * ```typescript
 * import { configure, P47hVault } from '@p47h/vault-js';
 * 
 * // Use CDN with fallback (recommended for production)
 * configure({
 *   wasmStrategy: 'cdn',
 *   cdnUrl: 'https://cdn.p47h.com/wasm/v1.0.1/p47h_wasm_core_bg.wasm'
 * });
 * 
 * const vault = new P47hVault();
 * await vault.init();
 * ```
 * 
 * @example
 * ```typescript
 * // Use inline WASM (no external files)
 * import { configure } from '@p47h/vault-js';
 * import { loadInlineWasm } from '@p47h/vault-js/wasm-inline';
 * 
 * configure({
 *   wasmStrategy: 'custom',
 *   customLoader: loadInlineWasm
 * });
 * ```
 */
export function configure(config: P47hVaultConfig): P47hVaultConfig {
  currentConfig = {
    ...defaultConfig,
    ...config
  };

  if (currentConfig.debug) {
    console.log('[p47h-vault] Configuration updated:', currentConfig);
  }

  return currentConfig;
}

/**
 * Gets the current configuration.
 * @returns Current configuration
 */
export function getConfig(): P47hVaultConfig {
  return { ...currentConfig };
}

/**
 * Resets configuration to defaults.
 */
export function resetConfig(): void {
  currentConfig = { ...defaultConfig };
}

/**
 * Helper to determine if inline mode should be used.
 */
export function isInlineMode(): boolean {
  return currentConfig.wasmStrategy === 'inline';
}

/**
 * Helper to determine if CDN mode should be used.
 */
export function isCdnMode(): boolean {
  return currentConfig.wasmStrategy === 'cdn';
}

/**
 * Helper to get the effective WASM URL based on strategy.
 */
export function getWasmUrl(): string {
  switch (currentConfig.wasmStrategy) {
    case 'cdn':
      return currentConfig.cdnUrl ?? defaultConfig.cdnUrl;
    case 'fetch':
    default:
      return currentConfig.wasmPath ?? defaultConfig.wasmPath;
  }
}
