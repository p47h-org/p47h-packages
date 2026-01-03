/**
 * @fileoverview P47H Vault Service - Core Identity and Secret Management
 * 
 * This is the main facade for the P47H Vault SDK. It provides a high-level,
 * type-safe API for:
 * - Creating and managing cryptographic identities (DIDs)
 * - Securely storing and retrieving encrypted secrets
 * - Emergency recovery using Recovery Codes (PUK)
 * - Session management with automatic memory cleanup
 * 
 * @module logic/VaultService
 * @license Apache-2.0
 */

import type { IVault } from '../domain/IVault';
import type { IStorage } from '../domain/IStorage';
import type { 
  VaultConfig, 
  IdentityInfo, 
  EncryptedVaultBlob,
  RegistrationResult,
  RecoveryOptions,
  RecoveryResult
} from '../domain/types';
import { 
  InitializationError, 
  NotAuthenticatedError, 
  AuthenticationError, 
  VaultError 
} from '../domain/errors';
import { WasmCryptoAdapter, type P47hClientInstance } from '../adapters/WasmCryptoAdapter';
import { BrowserStorage } from '../adapters/IndexedDbStorage';

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Internal structure of the encrypted vault JSON payload.
 * @internal
 */
interface VaultInternalData {
  readonly did: string;
  readonly wrappedSecret: string;  // Base64 encoded
  readonly salt: string;           // Base64 encoded
  secrets: Record<string, string>; // User secrets map
  createdAt: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Recovery code format: RK-XXXX-XXXX-XXXX-XXXX (16 bytes = 32 hex chars) */
const RECOVERY_CODE_PREFIX = 'RK';
const RECOVERY_CODE_BYTES = 16;

// ============================================================================
// VaultService Class
// ============================================================================

/**
 * P47H Vault Service - Secure local-first identity and secret management.
 * 
 * This service provides:
 * - **Identity Management**: Create and restore Ed25519 cryptographic identities
 * - **Secret Storage**: Encrypt and persist arbitrary secrets locally
 * - **Emergency Recovery**: Recover access using Recovery Codes (like 1Password)
 * - **Memory Safety**: Automatic cleanup of sensitive data from RAM
 * 
 * ## Security Model
 * 
 * - All cryptographic operations are performed in WASM (Rust)
 * - Private keys never leave WASM memory as plaintext
 * - Session keys are derived using Argon2id (OWASP recommended)
 * - Data is encrypted using XChaCha20-Poly1305 (AEAD)
 * - Dual encryption: password + recovery code for emergency access
 * 
 * @example
 * ```typescript
 * import { P47hVault } from '@p47h/vault-js';
 * 
 * const vault = new P47hVault();
 * await vault.init({ wasmPath: '/wasm/p47h_vault_v0.10.0.wasm' });
 * 
 * // Create new identity - SAVE THE RECOVERY CODE!
 * const { did, recoveryCode } = await vault.register('my-secure-password');
 * console.log('Created:', did);
 * console.log('⚠️ Save this recovery code:', recoveryCode);
 * 
 * // If password is forgotten:
 * await vault.recoverAccount({
 *   recoveryCode: 'RK-A1B2C3D4...',
 *   newPassword: 'new-secure-password'
 * });
 * ```
 * 
 * @implements {IVault}
 */
export class VaultService implements IVault {
  // ============================================================================
  // Private State
  // ============================================================================

  private readonly _storage: IStorage;
  private _crypto: WasmCryptoAdapter;
  private _client: P47hClientInstance | null = null;
  private _sessionKey: Uint8Array | null = null;
  private _currentDid: string | null = null;
  private _secretsCache: Record<string, string> | null = null;
  private _passwordCache: string | null = null;
  private _isInitialized = false;
  private _isDisposed = false;

  // ============================================================================
  // Constructor
  // ============================================================================

  /**
   * Creates a new VaultService instance with default adapters.
   * 
   * @param storage - Optional custom storage adapter (defaults to IndexedDB)
   */
  constructor(storage?: IStorage) {
    this._crypto = new WasmCryptoAdapter();
    this._storage = storage ?? new BrowserStorage();
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initializes the vault with optional configuration.
   * 
   * @param config - Optional configuration object
   * @returns Promise that resolves when initialization is complete
   * @throws {InitializationError} If WASM loading fails
   */
  async init(config?: VaultConfig): Promise<void> {
    this.ensureNotDisposed();
    
    if (this._isInitialized) {
      return; // Idempotent
    }

    if (config?.wasmPath) {
      this._crypto = new WasmCryptoAdapter({ wasmPath: config.wasmPath });
    }

    await this._crypto.init();
    this._isInitialized = true;
  }

  // ============================================================================
  // Identity Management
  // ============================================================================

  /**
   * Creates a new cryptographic identity and persists it encrypted.
   * 
   * This method:
   * 1. Generates a new Ed25519 keypair in WASM
   * 2. Derives a session key from the password using Argon2id
   * 3. Generates a high-entropy Recovery Code
   * 4. Encrypts the vault twice: once with password, once with recovery code
   * 5. Persists both encrypted copies to storage
   * 6. Establishes an authenticated session
   * 
   * **CRITICAL**: The returned `recoveryCode` is the ONLY way to recover
   * the vault if the password is lost. It must be stored securely by the user
   * (e.g., printed and stored in a safe, password manager, etc.).
   * 
   * @param password - Master password for key derivation (min 8 chars recommended)
   * @returns Promise resolving to the DID and recovery code
   * @throws {InitializationError} If vault not initialized
   * @throws {CryptoError} If key generation fails
   * @throws {StorageError} If persistence fails
   * 
   * @example
   * ```typescript
   * const { did, recoveryCode } = await vault.register('my-secure-password');
   * console.log('New identity:', did);
   * console.log('⚠️ SAVE THIS CODE:', recoveryCode);
   * // recoveryCode format: RK-A1B2C3D4-E5F6G7H8-I9J0K1L2-M3N4O5P6
   * ```
   */
  async register(password: string): Promise<RegistrationResult> {
    this.ensureInitialized();

    // Generate identity and derive encryption keys
    const client = this._crypto.createIdentity();
    const did = client.get_did();

    const salt = this._crypto.getRandomValues(16);
    const sessionKey = this._crypto.deriveSessionKey(password, salt);

    // Export wrapped (encrypted) private key
    const wrappedSecret = client.export_wrapped_secret(sessionKey);

    // Prepare internal vault data structure
    const internalData: VaultInternalData = {
      did,
      wrappedSecret: this.toBase64(wrappedSecret),
      salt: this.toBase64(salt),
      secrets: {},
      createdAt: Date.now(),
    };

    const internalJson = JSON.stringify(internalData);
    const internalBytes = new TextEncoder().encode(internalJson);

    // Create encrypted copies for password and recovery access
    const encryptedMain = this._crypto.encryptVault(internalBytes, password);
    const recoveryCode = this.generateRecoveryCode();
    const encryptedRecovery = this._crypto.encryptVault(internalBytes, recoveryCode);

    // Persist to storage
    const storageBlob: EncryptedVaultBlob = {
      version: 1,
      did,
      salt: this.toBase64(salt),
      wrappedData: this.toBase64(encryptedMain),
      recoveryBlob: this.toBase64(encryptedRecovery),
      updatedAt: Date.now()
    };

    await this._storage.save(did, storageBlob);

    // Establish authenticated session
    this.setSession(client, sessionKey, did, password, {});

    return { did, recoveryCode };
  }

  /**
   * Unlocks an existing identity with the master password.
   * 
   * This method:
   * 1. Retrieves the encrypted identity from storage
   * 2. Decrypts and validates the vault data
   * 3. Restores the Ed25519 keypair in WASM
   * 4. Establishes an authenticated session
   * 
   * @param password - Master password used during registration
   * @param did - Optional specific DID to unlock (uses first found if omitted)
   * @returns Promise resolving to the identity info
   * @throws {InitializationError} If vault not initialized
   * @throws {AuthenticationError} If password is wrong or identity not found
   * @throws {VaultError} If vault data is corrupted
   * 
   * @example
   * ```typescript
   * try {
   *   const identity = await vault.login('my-password');
   *   console.log('Unlocked:', identity.did);
   * } catch (e) {
   *   if (e instanceof AuthenticationError) {
   *     console.error('Wrong password - use recovery code?');
   *   }
   * }
   * ```
   */
  async login(password: string, did?: string): Promise<IdentityInfo> {
    this.ensureInitialized();

    // 1. Resolve target DID
    let targetDid = did;
    if (!targetDid) {
      const keys = await this._storage.listKeys();
      if (keys.length === 0) {
        throw new AuthenticationError('No identities found in storage');
      }
      targetDid = keys[0];
    }

    // 2. Retrieve encrypted blob
    const storedBlob = await this._storage.get(targetDid);
    if (!storedBlob) {
      throw new AuthenticationError(`Identity ${targetDid} not found`);
    }

    // 3. Decrypt outer blob
    let decryptedBytes: Uint8Array;
    try {
      decryptedBytes = this._crypto.decryptVault(
        this.fromBase64(storedBlob.wrappedData),
        password
      );
    } catch {
      throw new AuthenticationError('Invalid password or corrupted vault');
    }

    // 4. Parse internal data
    let internalData: VaultInternalData;
    try {
      const json = new TextDecoder().decode(decryptedBytes);
      internalData = JSON.parse(json);
    } catch {
      throw new VaultError('Vault data corruption: Invalid JSON', 'CORRUPT_DATA');
    }

    // 5. Integrity check
    if (internalData.did !== targetDid) {
      throw new VaultError('Integrity error: DID mismatch inside vault', 'INTEGRITY_ERROR');
    }

    // 6. Restore WASM client
    const salt = this.fromBase64(internalData.salt);
    const sessionKey = this._crypto.deriveSessionKey(password, salt);
    const wrappedSecret = this.fromBase64(internalData.wrappedSecret);

    const client = this._crypto.restoreIdentity(wrappedSecret, sessionKey);

    // 7. Establish session
    this.setSession(client, sessionKey, targetDid, password, internalData.secrets);

    return {
      did: targetDid,
      publicKey: client.get_public_key()
    };
  }

  /**
   * Recovers account access using the emergency recovery code.
   * 
   * Use this when the user has forgotten their password but has their
   * Recovery Code (Emergency Kit). This will:
   * 1. Decrypt the vault using the recovery code
   * 2. Re-encrypt with the new password
   * 3. Optionally generate a new recovery code (recommended)
   * 4. Auto-login with the new credentials
   * 
   * @param options - Recovery options including recovery code and new password
   * @returns Recovery result with optional new recovery code
   * @throws {AuthenticationError} If recovery code is invalid
   * @throws {VaultError} If recovery is not available for this identity
   * 
   * @example
   * ```typescript
   * // Basic recovery
   * const result = await vault.recoverAccount({
   *   recoveryCode: 'RK-A1B2C3D4-E5F6G7H8-I9J0K1L2-M3N4O5P6',
   *   newPassword: 'my-new-secure-password'
   * });
   * 
   * // Recovery with code rotation (recommended)
   * const result = await vault.recoverAccount({
   *   recoveryCode: 'RK-A1B2C3D4-...',
   *   newPassword: 'my-new-secure-password',
   *   rotateRecoveryCode: true
   * });
   * console.log('⚠️ NEW recovery code:', result.newRecoveryCode);
   * ```
   */
  async recoverAccount(options: RecoveryOptions): Promise<RecoveryResult> {
    this.ensureInitialized();

    const { recoveryCode, newPassword, did, rotateRecoveryCode = false } = options;

    // 1. Resolve target DID
    let targetDid = did;
    if (!targetDid) {
      const keys = await this._storage.listKeys();
      if (keys.length === 0) {
        throw new AuthenticationError('No vaults found');
      }
      targetDid = keys[0];
    }

    // 2. Get stored blob
    const stored = await this._storage.get(targetDid);
    if (!stored) {
      throw new AuthenticationError(`Identity ${targetDid} not found`);
    }
    
    if (!stored.recoveryBlob) {
      throw new VaultError(
        'Recovery not available for this identity. It may have been created with an older SDK version.',
        'RECOVERY_UNAVAILABLE'
      );
    }

    // 3. Decrypt using recovery code
    let decryptedBytes: Uint8Array;
    try {
      decryptedBytes = this._crypto.decryptVault(
        this.fromBase64(stored.recoveryBlob),
        recoveryCode
      );
    } catch {
      throw new AuthenticationError('Invalid Recovery Code');
    }

    // Parse to validate JSON structure (data is re-encrypted from decryptedBytes)
    let internalData: VaultInternalData;
    try {
      const json = new TextDecoder().decode(decryptedBytes);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      internalData = JSON.parse(json);
    } catch {
      throw new VaultError('Vault data corruption during recovery', 'CORRUPT_DATA');
    }

    // 5. Re-encrypt with new password
    const newEncryptedMain = this._crypto.encryptVault(decryptedBytes, newPassword);

    // 6. Handle recovery code rotation
    let newRecoveryCode: string | undefined;
    let newRecoveryBlob: string;

    if (rotateRecoveryCode) {
      // Generate new recovery code
      newRecoveryCode = this.generateRecoveryCode();
      const newEncryptedRecovery = this._crypto.encryptVault(decryptedBytes, newRecoveryCode);
      newRecoveryBlob = this.toBase64(newEncryptedRecovery);
    } else {
      // Keep existing recovery blob
      newRecoveryBlob = stored.recoveryBlob;
    }

    // 7. Update storage
    stored.wrappedData = this.toBase64(newEncryptedMain);
    stored.recoveryBlob = newRecoveryBlob;
    stored.updatedAt = Date.now();

    await this._storage.save(targetDid, stored);

    // 8. Auto-login with new password
    await this.login(newPassword, targetDid);

    return {
      did: targetDid,
      newRecoveryCode
    };
  }

  /**
   * Locks the vault and clears all sensitive data from memory.
   * 
   * This method:
   * 1. Frees WASM memory holding the private key
   * 2. Clears the session key from JavaScript heap
   * 3. Clears the password cache
   * 4. Clears the secrets cache
   * 
   * Always call this when the user logs out or the app is backgrounded.
   */
  lock(): void {
    if (this._client) {
      try {
        this._client.free();
      } catch {
        // Ignore free errors (already freed)
      }
      this._client = null;
    }
    
    // Clear sensitive data
    this._sessionKey = null;
    this._currentDid = null;
    this._secretsCache = null;
    this._passwordCache = null;
  }

  /**
   * Checks if the vault is currently unlocked with an active session.
   * 
   * @returns True if an identity is loaded and session is active
   */
  isAuthenticated(): boolean {
    return this._client !== null && !this._isDisposed;
  }

  /**
   * Gets the DID of the currently authenticated identity.
   * 
   * @returns The current Decentralized Identifier
   * @throws {NotAuthenticatedError} If vault is locked
   */
  getDid(): string {
    this.ensureAuthenticated();
    return this._currentDid!;
  }

  /**
   * Returns a list of DIDs (identities) that exist in local storage.
   * Useful for UI to decide whether to show Login or Register.
   * 
   * @returns Promise resolving to array of DID strings
   * @throws {InitializationError} If vault not initialized
   */
  async getStoredIdentities(): Promise<string[]> {
    this.ensureInitialized();
    return this._storage.listKeys();
  }

  // ============================================================================
  // Cryptographic Operations
  // ============================================================================

  /**
   * Signs arbitrary data with the current identity's private key.
   * 
   * Uses Ed25519 signatures. The private key never leaves WASM memory.
   * 
   * @param data - Data to sign
   * @returns Promise resolving to the 64-byte Ed25519 signature
   * @throws {NotAuthenticatedError} If vault is locked
   */
  async sign(data: Uint8Array): Promise<Uint8Array> {
    this.ensureAuthenticated();
    return this._client!.sign_data(data);
  }

  // ============================================================================
  // Secret Management
  // ============================================================================

  /**
   * Saves an encrypted secret to the vault.
   * 
   * The secret is:
   * 1. Stored in the in-memory cache
   * 2. Re-encrypted with the vault's master key
   * 3. Persisted to storage (both password and recovery copies)
   * 
   * @param key - Unique identifier for the secret
   * @param secret - The secret value to store
   * @throws {NotAuthenticatedError} If vault is locked
   * @throws {VaultError} If storage operation fails
   */
  async saveSecret(key: string, secret: string): Promise<void> {
    this.ensureAuthenticated();

    if (!this._secretsCache || !this._passwordCache || !this._currentDid) {
      throw new NotAuthenticatedError();
    }

    // Update in-memory cache
    this._secretsCache[key] = secret;

    // Retrieve and update persisted blob
    const stored = await this._storage.get(this._currentDid);
    if (!stored) {
      throw new VaultError('Storage corruption during save', 'STORAGE_ERROR');
    }
    
    // Decrypt, update, re-encrypt
    const decrypted = this._crypto.decryptVault(
      this.fromBase64(stored.wrappedData), 
      this._passwordCache
    );
    const originalData = JSON.parse(new TextDecoder().decode(decrypted)) as VaultInternalData;
    
    originalData.secrets = { ...this._secretsCache };
    originalData.createdAt = Date.now();
    
    const updatedBytes = new TextEncoder().encode(JSON.stringify(originalData));
    
    // Re-encrypt main copy
    const newEncryptedMain = this._crypto.encryptVault(updatedBytes, this._passwordCache);
    stored.wrappedData = this.toBase64(newEncryptedMain);
    stored.updatedAt = Date.now();
    
    await this._storage.save(this._currentDid, stored);
  }

  /**
   * Retrieves a decrypted secret from the vault.
   * 
   * @param key - The secret identifier
   * @returns The decrypted secret value, or null if not found
   * @throws {NotAuthenticatedError} If vault is locked
   */
  async getSecret(key: string): Promise<string | null> {
    this.ensureAuthenticated();
    return this._secretsCache?.[key] ?? null;
  }

  // ============================================================================
  // Lifecycle Management
  // ============================================================================

  /**
   * Disposes of the vault and releases all resources.
   * 
   * After calling dispose():
   * - All sensitive data is cleared from memory
   * - The vault cannot be used again
   * - A new VaultService instance must be created
   */
  dispose(): void {
    if (this._isDisposed) return;
    
    this.lock();
    this._isInitialized = false;
    this._isDisposed = true;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Generates a high-entropy recovery code.
   * Format: RK-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX (32 hex chars)
   */
  private generateRecoveryCode(): string {
    const bytes = this._crypto.getRandomValues(RECOVERY_CODE_BYTES);
    const hex = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join('');
    
    // Format: RK-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX
    return `${RECOVERY_CODE_PREFIX}-${hex.slice(0, 8)}-${hex.slice(8, 16)}-${hex.slice(16, 24)}-${hex.slice(24, 32)}`;
  }

  private ensureNotDisposed(): void {
    if (this._isDisposed) {
      throw new VaultError('VaultService has been disposed', 'DISPOSED');
    }
  }

  private ensureInitialized(): void {
    this.ensureNotDisposed();
    if (!this._isInitialized) {
      throw new InitializationError('VaultService not initialized. Call init() first.');
    }
  }

  private ensureAuthenticated(): void {
    this.ensureInitialized();
    if (!this._client) {
      throw new NotAuthenticatedError();
    }
  }

  private setSession(
    client: P47hClientInstance, 
    sessionKey: Uint8Array, 
    did: string, 
    password: string,
    secrets: Record<string, string>
  ): void {
    this._client = client;
    this._sessionKey = sessionKey;
    this._currentDid = did;
    this._passwordCache = password;
    this._secretsCache = { ...secrets };
  }

  private toBase64(bytes: Uint8Array): string {
    const binString = Array.from(bytes, (x) => String.fromCharCode(x)).join('');
    return btoa(binString);
  }

  private fromBase64(base64: string): Uint8Array {
    const binString = atob(base64);
    return Uint8Array.from(binString, (m) => m.codePointAt(0)!);
  }
}
