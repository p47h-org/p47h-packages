/**
 * @fileoverview P47H Vault Domain Types
 * 
 * Core entities and value objects for the vault system.
 * 
 * @module domain/types
 * @license Apache-2.0
 */

import { IStorage } from './IStorage';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration options for initializing the P47H Vault.
 */
export interface VaultConfig {
  /**
   * Path to the WASM binary file.
   * @default '/wasm/p47h_vault_v{VERSION}.wasm'
   */
  wasmPath?: string;
  
  /**
   * Custom storage adapter implementation.
   * If not provided, uses IndexedDB by default.
   */
  storage?: IStorage;
}

// ============================================================================
// Identity Types
// ============================================================================

/**
 * Public information about a loaded cryptographic identity.
 */
export interface IdentityInfo {
  /** Decentralized Identifier (DID) for this identity */
  did: string;
  /** Raw Ed25519 public key bytes (32 bytes) */
  publicKey: Uint8Array;
}

/**
 * Result of a successful registration including the recovery code.
 */
export interface RegistrationResult {
  /** The newly created Decentralized Identifier */
  did: string;
  /** 
   * Emergency recovery code - MUST be stored securely by the user.
   * Format: RK-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX
   * This is the ONLY way to recover the vault if the password is lost.
   */
  recoveryCode: string;
}

// ============================================================================
// Storage Types
// ============================================================================

/**
 * Encrypted vault blob as persisted to storage.
 * Contains both password-encrypted and recovery-encrypted copies.
 */
export interface EncryptedVaultBlob {
  /** Schema version for future migrations */
  version: number;
  
  /** DID associated with this vault */
  did: string;
  
  /** Salt used for password key derivation (Base64) */
  salt: string;
  
  /** Vault data encrypted with user password (Base64) */
  wrappedData: string;
  
  /** 
   * Vault data encrypted with recovery code (Base64).
   * Used for password recovery without server involvement.
   */
  recoveryBlob?: string;
  
  /** Timestamp of last update (Unix ms) */
  updatedAt: number;
}

// ============================================================================
// Recovery Types
// ============================================================================

/**
 * Options for account recovery using the emergency recovery code.
 */
export interface RecoveryOptions {
  /** The recovery code provided during registration */
  recoveryCode: string;
  /** The new password to set */
  newPassword: string;
  /** Optional specific DID to recover (uses first found if omitted) */
  did?: string;
  /** 
   * If true, generates a new recovery code after successful recovery.
   * Recommended for security.
   * @default false
   */
  rotateRecoveryCode?: boolean;
}

/**
 * Result of a successful account recovery.
 */
export interface RecoveryResult {
  /** The recovered identity's DID */
  did: string;
  /** 
   * New recovery code (only present if rotateRecoveryCode was true).
   * If present, the old recovery code is invalidated.
   */
  newRecoveryCode?: string;
}