/**
 * @fileoverview P47H Vault Interface - Core Contract
 * 
 * This interface defines the public API for the P47H Vault.
 * All vault implementations must conform to this contract.
 * 
 * @module domain/IVault
 * @license Apache-2.0
 */

import type { 
  IdentityInfo, 
  VaultConfig, 
  RegistrationResult, 
  RecoveryOptions,
  RecoveryResult 
} from './types';

/**
 * Core interface for the P47H Vault.
 * 
 * Defines all cryptographic and identity management operations
 * that a vault implementation must provide.
 */
export interface IVault {
  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initializes the cryptographic environment (WASM module).
   * Must be called before any other operation.
   * 
   * @param config - Optional configuration object
   * @throws {InitializationError} If WASM loading fails
   */
  init(config?: VaultConfig): Promise<void>;

  // ============================================================================
  // Identity Management
  // ============================================================================

  /**
   * Creates a new cryptographic identity (DID) and persists it encrypted.
   * Generates Ed25519 keys and encrypts them with the provided password.
   * 
   * **IMPORTANT**: The returned `recoveryCode` is the ONLY way to recover
   * the vault if the password is lost. It must be stored securely by the user.
   * 
   * @param password - Master password for key derivation
   * @returns The generated DID and emergency recovery code
   * @throws {InitializationError} If vault not initialized
   * @throws {CryptoError} If key generation fails
   */
  register(password: string): Promise<RegistrationResult>;

  /**
   * Unlocks an existing identity with the master password.
   * Decrypts the private keys and establishes an authenticated session.
   * 
   * @param password - Master password
   * @param did - Optional specific DID to unlock (uses first found if omitted)
   * @throws {AuthenticationError} If password is wrong or identity not found
   * @throws {VaultError} If vault data is corrupted
   */
  login(password: string, did?: string): Promise<IdentityInfo>;

  /**
   * Recovers account access using the emergency recovery code.
   * 
   * Use this when the user has forgotten their password but has their
   * recovery code. This will:
   * 1. Decrypt the vault using the recovery code
   * 2. Re-encrypt with the new password
   * 3. Optionally generate a new recovery code
   * 
   * @param options - Recovery options including recovery code and new password
   * @returns Recovery result with optional new recovery code
   * @throws {AuthenticationError} If recovery code is invalid
   * @throws {VaultError} If recovery is not available for this identity
   */
  recoverAccount(options: RecoveryOptions): Promise<RecoveryResult>;

  /**
   * Locks the vault and clears all sensitive data from memory.
   * Frees WASM memory, session keys, and cached secrets.
   */
  lock(): void;

  /**
   * Checks if the vault is currently unlocked.
   * 
   * @returns True if an identity is loaded and session is active
   */
  isAuthenticated(): boolean;

  /**
   * Gets the DID of the currently authenticated identity.
   * 
   * @returns The current Decentralized Identifier
   * @throws {NotAuthenticatedError} If vault is locked
   */
  getDid(): string;

  /**
   * Returns a list of DIDs (identities) that exist in local storage.
   * Useful for UI to decide whether to show Login or Register.
   * 
   * @returns Array of DID strings stored locally
   * @throws {InitializationError} If vault not initialized
   */
  getStoredIdentities(): Promise<string[]>;

  // ============================================================================
  // Cryptographic Operations
  // ============================================================================

  /**
   * Signs data with the current identity's private key (Ed25519).
   * 
   * @param data - Data to sign
   * @returns 64-byte Ed25519 signature
   * @throws {NotAuthenticatedError} If vault is locked
   */
  sign(data: Uint8Array): Promise<Uint8Array>;

  // ============================================================================
  // Secret Management
  // ============================================================================

  /**
   * Saves an encrypted secret to the vault.
   * 
   * @param key - Unique identifier for the secret
   * @param secret - The secret value to store
   * @throws {NotAuthenticatedError} If vault is locked
   * @throws {VaultError} If storage operation fails
   */
  saveSecret(key: string, secret: string): Promise<void>;

  /**
   * Retrieves a decrypted secret from the vault.
   * 
   * @param key - The secret identifier
   * @returns The decrypted value, or null if not found
   * @throws {NotAuthenticatedError} If vault is locked
   */
  getSecret(key: string): Promise<string | null>;

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Disposes of the vault and releases all resources.
   * After calling dispose(), the vault cannot be used again.
   */
  dispose(): void;
}