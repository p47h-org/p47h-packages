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
 * Result of a successful registration.
 *
 * NOTE: there is deliberately no recovery code. See RECOVERY.md — the password
 * is the only key to the vault, and a lost password means lost data.
 */
export interface RegistrationResult {
  /** The newly created Decentralized Identifier */
  did: string;
}

// ============================================================================
// Storage Types
// ============================================================================

/**
 * Encrypted vault blob as persisted to storage.
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
  
  /** Timestamp of last update (Unix ms) */
  updatedAt: number;
}

