/**
 * @fileoverview Provider Configuration Types
 *
 * Configuration and props for the P47hProvider component.
 *
 * @module types/provider
 * @license Apache-2.0
 */

import type { ReactNode } from 'react';
import type { VaultConfig } from '@p47h/vault-js';

// ============================================================================
// Provider Configuration
// ============================================================================

/**
 * Configuration options for the P47hProvider component.
 */
export interface P47hProviderConfig extends VaultConfig {
  /**
   * Automatically restore session if identity exists in storage.
   * @default false
   */
  autoRestore?: boolean;

  /**
   * Timeout in milliseconds for WASM initialization.
   * If exceeded, the provider will transition to error state.
   * @default 30000 (30 seconds)
   */
  initTimeout?: number;

  /**
   * Number of retry attempts for WASM initialization.
   * @default 2
   */
  initRetries?: number;

  /**
   * Delay between retry attempts in milliseconds.
   * @default 1000
   */
  retryDelay?: number;
}

/**
 * Props for the P47hProvider component.
 */
export interface P47hProviderProps {
  /**
   * Child components to render.
   */
  children: ReactNode;

  /**
   * Optional vault configuration.
   */
  config?: P47hProviderConfig;

  /**
   * Fallback UI to show while WASM is loading.
   * Can be a ReactNode or a function that receives elapsed time.
   */
  fallback?: ReactNode | ((elapsedMs: number) => ReactNode);

  /**
   * Error boundary fallback to show on fatal errors.
   */
  errorFallback?: ReactNode | ((error: Error) => ReactNode);

  /**
   * Callback fired when initialization times out.
   * Useful for analytics or showing retry UI.
   */
  onInitTimeout?: (elapsedMs: number) => void;

  /**
   * Callback fired on any initialization error.
   */
  onInitError?: (error: Error) => void;
}
