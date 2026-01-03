/**
 * @fileoverview P47H Vault JS SDK - Entry Point
 * 
 * Secure local-first cryptographic vault for the browser.
 * 
 * Architecture: Clean Architecture with Use Cases
 * - Domain: Interfaces, types, errors
 * - Application: Use cases, services
 * - Adapters: WASM crypto, IndexedDB storage
 * - Facade: Main API entry point
 * 
 * @module @p47h/vault-js
 * @license Apache-2.0
 */

// ============================================================================
// Main API
// ============================================================================

// Primary facade - exported as P47hVault for brand consistency
export { VaultFacade as P47hVault } from './logic/VaultFacade';

// Backward compatibility alias
export { VaultService } from './logic/VaultFacade';

// ============================================================================
// Domain Interfaces (Contracts)
// ============================================================================

export type { IVault } from './domain/IVault';
export type { IStorage } from './domain/IStorage';

// ============================================================================
// Types (Entities & Value Objects)
// ============================================================================

export type { 
  VaultConfig, 
  IdentityInfo, 
  EncryptedVaultBlob,
  RegistrationResult,
  RecoveryOptions,
  RecoveryResult
} from './domain/types';

// ============================================================================
// Errors (Typed Exceptions)
// ============================================================================

export { 
  VaultError,
  InitializationError,
  AuthenticationError, 
  NotAuthenticatedError,
  StorageError,
  CryptoError
} from './domain/errors';

// ============================================================================
// Application Layer (Use Cases & Services)
// ============================================================================

export {
  RegisterIdentityUseCase,
  LoginUseCase,
  RecoverAccountUseCase,
  SecretManagementUseCase,
  SessionManager
} from './application';

export type {
  RegisterInput,
  LoginInput,
  SessionState,
  ICryptoPort,
  ICryptoClient
} from './application';

// ============================================================================
// Adapters (Optional - for extension/customization)
// ============================================================================

export { BrowserStorage } from './adapters/IndexedDbStorage';

// ============================================================================
// Utilities
// ============================================================================

export { toBase64, fromBase64 } from './utils/encoding';