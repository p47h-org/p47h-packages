/**
 * @fileoverview P47H Vault Facade - Clean Architecture Entry Point
 * 
 * This is the main facade for the P47H Vault SDK. It provides a high-level,
 * type-safe API by delegating to specialized use cases and services.
 * 
 * Architecture:
 * - Domain: Interfaces, types, errors (pure business logic contracts)
 * - Application: Use cases, services (orchestration logic)
 * - Adapters: WASM crypto, IndexedDB storage (infrastructure)
 * - Facade: This file (thin orchestration layer)
 * 
 * @module logic/VaultFacade
 * @license Apache-2.0
 */

import type { IVault } from '../domain/IVault';
import type { IStorage } from '../domain/IStorage';
import type { 
  VaultConfig, 
  IdentityInfo,
  RegistrationResult
} from '../domain/types';
import { 
  InitializationError, 
  NotAuthenticatedError,
  VaultError 
} from '../domain/errors';

// Application Layer
import { 
  RegisterIdentityUseCase,
  LoginUseCase,
  SecretManagementUseCase,
  SessionManager
} from '../application';

// Adapters
import { WasmCryptoAdapter } from '../adapters/WasmCryptoAdapter';
import { BrowserStorage } from '../adapters/IndexedDbStorage';

/**
 * P47H Vault Facade - Secure local-first identity and secret management.
 * 
 * This facade provides:
 * - **Identity Management**: Create and restore Ed25519 cryptographic identities
 * - **Secret Storage**: Encrypt and persist arbitrary secrets locally
 * - **Memory Safety**: Automatic cleanup of sensitive data from RAM
 * 
 * ## Security Model
 * 
 * - All cryptographic operations are performed in WASM (Rust)
 * - Private keys never leave WASM memory as plaintext
 * - Session keys are derived using Argon2id (OWASP recommended)
 * - Data is encrypted using XChaCha20-Poly1305 (AEAD)
 * - There is NO recovery mechanism: the password is the only key (see RECOVERY.md)
 * 
 * @example
 * ```typescript
 * import { P47hVault } from '@p47h/vault-js';
 * 
 * const vault = new P47hVault();
 * await vault.init({ wasmPath: '/wasm/p47h_vault_v0.10.0.wasm' });
 * 
 * // Create a new identity. There is no recovery code and no way back:
 * // if the password is lost, the data is gone.
 * const { did } = await vault.register('my-secure-password');
 * console.log('Created:', did);
 * ```
 * 
 * @implements {IVault}
 */
export class VaultFacade implements IVault {
  // ============================================================================
  // Dependencies (Adapters)
  // ============================================================================
  
  private readonly _storage: IStorage;
  private _crypto: WasmCryptoAdapter;

  // ============================================================================
  // Services
  // ============================================================================

  private readonly _session: SessionManager;

  // ============================================================================
  // Use Cases (lazily initialized after init())
  // ============================================================================

  private _registerUseCase: RegisterIdentityUseCase | null = null;
  private _loginUseCase: LoginUseCase | null = null;
  private _secretsUseCase: SecretManagementUseCase | null = null;

  // ============================================================================
  // State
  // ============================================================================

  private _isInitialized = false;
  private _isDisposed = false;

  // ============================================================================
  // Constructor
  // ============================================================================

  /**
   * Creates a new VaultFacade instance with default adapters.
   * 
   * @param storage - Optional custom storage adapter (defaults to IndexedDB)
   */
  constructor(storage?: IStorage) {
    this._crypto = new WasmCryptoAdapter();
    this._storage = storage ?? new BrowserStorage();
    this._session = new SessionManager();
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

    // Configure crypto adapter with custom WASM path if provided
    if (config?.wasmPath) {
      this._crypto = new WasmCryptoAdapter({ wasmPath: config.wasmPath });
    }

    // Initialize WASM
    await this._crypto.init();
    
    // Initialize use cases now that crypto is ready
    this._initializeUseCases();
    
    this._isInitialized = true;
  }

  /**
   * Initializes all use cases with their dependencies.
   * Called after WASM is ready.
   */
  private _initializeUseCases(): void {
    this._registerUseCase = new RegisterIdentityUseCase(
      this._crypto,
      this._storage,
      this._session
    );
    
    this._loginUseCase = new LoginUseCase(
      this._crypto,
      this._storage,
      this._session
    );
    
    this._secretsUseCase = new SecretManagementUseCase(
      this._crypto,
      this._storage,
      this._session
    );
  }

  // ============================================================================
  // Identity Management (delegated to Use Cases)
  // ============================================================================

  /**
   * Creates a new cryptographic identity and persists it encrypted.
   * 
   * @param password - Master password for key derivation (min 8 chars recommended)
   * @returns Promise resolving to the DID
   * @throws {InitializationError} If vault not initialized
   */
  async register(password: string): Promise<RegistrationResult> {
    this.ensureInitialized();
    return this._registerUseCase!.execute({ password });
  }

  /**
   * Unlocks an existing identity with the master password.
   * 
   * @param password - Master password used during registration
   * @param did - Optional specific DID to unlock (uses first found if omitted)
   * @returns Promise resolving to the identity info
   * @throws {AuthenticationError} If password is wrong or identity not found
   */
  async login(password: string, did?: string): Promise<IdentityInfo> {
    this.ensureInitialized();
    const input = did !== undefined ? { password, did } : { password };
    return this._loginUseCase!.execute(input);
  }

  /**
   * Locks the vault and clears all sensitive data from memory.
   */
  lock(): void {
    this._session.clear();
  }

  /**
   * Checks if the vault is currently unlocked with an active session.
   */
  isAuthenticated(): boolean {
    return this._session.isAuthenticated() && !this._isDisposed;
  }

  /**
   * Gets the DID of the currently authenticated identity.
   * 
   * @throws {NotAuthenticatedError} If vault is locked
   */
  getDid(): string {
    this.ensureAuthenticated();
    return this._session.getDid();
  }

  /**
   * Returns a list of DIDs (identities) that exist in local storage.
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
   * @param data - Data to sign
   * @returns Promise resolving to the 64-byte Ed25519 signature
   * @throws {NotAuthenticatedError} If vault is locked
   */
  async sign(data: Uint8Array): Promise<Uint8Array> {
    this.ensureAuthenticated();
    return this._session.getClient().sign_data(data);
  }

  // ============================================================================
  // Secret Management (delegated to Use Case)
  // ============================================================================

  /**
   * Saves an encrypted secret to the vault.
   * 
   * @param key - Unique identifier for the secret
   * @param secret - The secret value to store
   * @throws {NotAuthenticatedError} If vault is locked
   */
  async saveSecret(key: string, secret: string): Promise<void> {
    this.ensureInitialized();
    return this._secretsUseCase!.saveSecret(key, secret);
  }

  /**
   * Retrieves a decrypted secret from the vault.
   * 
   * @param key - The secret identifier
   * @returns The decrypted value, or null if not found
   * @throws {NotAuthenticatedError} If vault is locked
   */
  async getSecret(key: string): Promise<string | null> {
    this.ensureInitialized();
    return this._secretsUseCase!.getSecret(key);
  }

  /**
   * Lists the keys of all secrets in the currently unlocked vault.
   *
   * Reads from the in-memory session (no decryption round-trip). Returns an empty
   * array when the vault holds no secrets.
   *
   * @returns The secret keys held by the unlocked identity
   * @throws {NotAuthenticatedError} If vault is locked
   */
  listSecretKeys(): string[] {
    this.ensureInitialized();
    return this._secretsUseCase!.listSecretKeys();
  }

  // ============================================================================
  // Lifecycle Management
  // ============================================================================

  /**
   * Disposes of the vault and releases all resources.
   */
  dispose(): void {
    if (this._isDisposed) return;
    
    this.lock();
    this._isInitialized = false;
    this._isDisposed = true;
  }

  // ============================================================================
  // Guard Methods
  // ============================================================================

  private ensureNotDisposed(): void {
    if (this._isDisposed) {
      throw new VaultError('VaultFacade has been disposed', 'DISPOSED');
    }
  }

  private ensureInitialized(): void {
    this.ensureNotDisposed();
    if (!this._isInitialized) {
      throw new InitializationError('VaultFacade not initialized. Call init() first.');
    }
  }

  private ensureAuthenticated(): void {
    this.ensureInitialized();
    if (!this._session.isAuthenticated()) {
      throw new NotAuthenticatedError();
    }
  }
}

// ============================================================================
// Backward Compatibility Export
// ============================================================================

/**
 * @deprecated Use VaultFacade instead. VaultService is an alias for backward compatibility.
 */
export { VaultFacade as VaultService };
