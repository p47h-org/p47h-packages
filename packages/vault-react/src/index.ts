/**
 * @fileoverview @p47h/vault-react - Entry Point
 * 
 * Encrypted persistent state for React applications.
 * Secure secrets locally. No backend. No WebCrypto. No leaks.
 * 
 * @module @p47h/vault-react
 * @license Apache-2.0
 */

// ============================================================================
// Provider & Context
// ============================================================================

export { P47hProvider } from './context/P47hProvider';
export { P47hContext } from './context/P47hContext';

// ============================================================================
// Hooks
// ============================================================================

export { useP47h } from './hooks/useP47h';
export { useIdentity } from './hooks/useIdentity';
export { useSecret } from './hooks/useSecret';

// ============================================================================
// Types
// ============================================================================

export type {
  // Provider types
  P47hProviderProps,
  P47hProviderConfig,
  P47hContextValue,

  // Hook return types
  UseIdentityReturn,
  UseSecretReturn,
  SecretStatus,

  // State types
  VaultState,
} from './types';

// ============================================================================
// Errors (for error handling in UI)
// ============================================================================

export {
  InitTimeoutError,
  WasmNotSupportedError,
  InitExhaustedError,
} from './internal/InitializationOrchestrator';

// ============================================================================
// Re-exports from @p47h/vault-js (for convenience)
// ============================================================================

export type {
  VaultConfig,
  IdentityInfo,
  RegistrationResult,
} from '@p47h/vault-js';

export {
  VaultError,
  AuthenticationError,
  NotAuthenticatedError,
  InitializationError,
} from '@p47h/vault-js';

// ============================================================================
// NOTE: VaultController is intentionally NOT exported.
// It is an internal implementation detail.
// ============================================================================
