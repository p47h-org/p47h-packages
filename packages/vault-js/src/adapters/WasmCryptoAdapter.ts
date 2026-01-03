/**
 * @fileoverview WASM Crypto Adapter for P47H Vault
 *
 * This module provides the bridge between TypeScript and the Rust/WASM
 * cryptographic core. It handles module loading, initialization, and
 * provides type-safe wrappers for all WASM operations.
 *
 * @module adapters/WasmCryptoAdapter
 * @license Apache-2.0
 */

import { InitializationError, CryptoError } from "../domain/errors";
import { REQUIRED_CORE_VERSION } from "../version";

// ============================================================================
// WASM Module Interface Types
// ============================================================================

/**
 * Internal interface for the WASM module exports.
 * @internal
 */
interface P47hWasmModule {
  readonly P47hClient: {
    new (): P47hClientInstance;
    from_wrapped_secret(
      wrapped: Uint8Array,
      sessionKey: Uint8Array
    ): P47hClientInstance;
  };
  readonly VaultCrypto: {
    encrypt_vault(data: Uint8Array, password: string): Uint8Array;
    decrypt_vault(blob: Uint8Array, password: string): Uint8Array;
    derive_session_key(password: string, salt: Uint8Array): Uint8Array;
  };
  init?: (options?: unknown) => Promise<void> | void;
  default: (
    input?: RequestInfo | URL | { module_or_path: RequestInfo | URL | string }
  ) => Promise<void>;

  // Version introspection
  get_core_version?: () => string;
  get_build_info?: () => string;
}

/**
 * Instance of a P47H cryptographic identity client.
 * Wraps an Ed25519 keypair in WASM memory.
 */
export interface P47hClientInstance {
  /** Returns the Decentralized Identifier (DID) for this identity */
  get_did(): string;
  /** Returns the raw Ed25519 public key bytes (32 bytes) */
  get_public_key(): Uint8Array;
  /** Exports the private key encrypted with session key */
  export_wrapped_secret(sessionKey: Uint8Array): Uint8Array;
  /** Signs arbitrary data with the private key */
  sign_data(data: Uint8Array): Uint8Array;
  /** Frees the WASM memory associated with this client */
  free(): void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Constructs versioned WASM path.
 * Version is embedded in filename to bust browser cache.
 */
function getDefaultWasmPath(): string {
  return `/wasm/p47h_vault_v${REQUIRED_CORE_VERSION}.wasm`;
}

// ============================================================================
// WasmCryptoAdapter Class
// ============================================================================

/**
 * Adapter for P47H WASM cryptographic operations.
 *
 * This class handles:
 * - Loading the WASM module (with bundler and fetch fallbacks)
 * - Version handshake to prevent cache corruption
 * - Key derivation using Argon2id
 * - Vault encryption/decryption using XChaCha20-Poly1305
 * - Identity creation and restoration using Ed25519
 *
 * @example
 * ```typescript
 * const adapter = new WasmCryptoAdapter();
 * await adapter.init();
 * 
 * const client = adapter.createIdentity();
 * console.log('DID:', client.get_did());
 * ```
 */
export class WasmCryptoAdapter {
  private module: P47hWasmModule | null = null;
  private readonly _wasmPath: string;
  private _isInitialized = false;

  /**
   * Creates a new WasmCryptoAdapter instance.
   *
   * @param options - Configuration options
   * @param options.wasmPath - Override the WASM path (defaults to versioned path)
   */
  constructor(options: { wasmPath?: string } = {}) {
    this._wasmPath = options.wasmPath ?? getDefaultWasmPath();
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initializes the WASM module.
   *
   * This method must be called before any other operations. It:
   * 1. Loads the WASM module (via bundler import or fetch fallback)
   * 2. Initializes the WASM instance with the binary
   * 3. Validates version handshake to prevent cache issues
   *
   * @throws {InitializationError} If WASM loading fails or version mismatch
   *
   * @example
   * ```typescript
   * await adapter.init();
   * ```
   */
  async init(): Promise<void> {
    // Idempotent: return if already initialized
    if (this._isInitialized && this.module) {
      return;
    }

    try {
      const wasmModule = await this.loadWasmModule();
      await this.initializeWasmInstance(wasmModule);
      
      // VERSION HANDSHAKE: Ensure SDK and WASM versions match
      this.validateVersionHandshake(wasmModule);

      this.module = wasmModule;
      this._isInitialized = true;
    } catch (error) {
      throw new InitializationError("Failed to load P47H WASM core", error);
    }
  }

  /**
   * Loads the WASM JavaScript glue module.
   * Uses fetch to load from public path - does not use static imports.
   */
  private async loadWasmModule(): Promise<P47hWasmModule> {
    // Construct versioned glue.js path matching the WASM binary
    const glueUrl = this._wasmPath.replace('.wasm', '.js');

    const response = await fetch(glueUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to load WASM module: HTTP ${response.status}. ` +
          `Ensure ${glueUrl} is available.`
      );
    }

    const code = await response.text();
    const blob = new Blob([code], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);

    try {
      // Dynamic import using blob URL - no static path analysis
      const module = await import(/* @vite-ignore */ url);
      return module;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Initializes the WASM instance with the binary module.
   */
  private async initializeWasmInstance(
    wasmModule: P47hWasmModule
  ): Promise<void> {
    // Try new wasm-bindgen format first, then legacy
    try {
      await wasmModule.default({ module_or_path: this._wasmPath });
    } catch {
      await wasmModule.default(this._wasmPath);
    }

    // Call optional init function (sets panic hook, etc.)
    if (typeof wasmModule.init === "function") {
      wasmModule.init();
    }
  }

  /**
   * Validates that the loaded WASM version matches the SDK version.
   * This prevents cache corruption and version mismatch issues.
   * @throws {InitializationError} If versions don't match
   */
  private validateVersionHandshake(wasmModule: P47hWasmModule): void {
    const EXPECTED_VERSION = REQUIRED_CORE_VERSION;
    
    if (typeof wasmModule.get_core_version !== "function") {
      // Legacy WASM without version - skip validation with warning
      console.warn(
        "⚠️ P47H: WASM version check skipped (legacy build without get_core_version)"
      );
      return;
    }
    
    const wasmVersion = wasmModule.get_core_version();
    
    if (wasmVersion !== EXPECTED_VERSION) {
      throw new InitializationError(
        `WASM Version Mismatch. JS SDK expects v${EXPECTED_VERSION} but loaded WASM v${wasmVersion}. ` +
        `Clear browser cache or ensure correct WASM binary is deployed.`
      );
    }
    
    console.log(`✅ P47H Vault Core v${wasmVersion} initialized`);
  }

  /**
   * Gets the loaded WASM module, throwing if not initialized.
   * @internal
   */
  private getModule(): P47hWasmModule {
    if (!this.module || !this._isInitialized) {
      throw new InitializationError(
        "WasmCryptoAdapter not initialized. Call init() first."
      );
    }
    return this.module;
  }

  // ============================================================================
  // Vault Operations (VaultCrypto)
  // ============================================================================

  /**
   * Derives a session key from a password using Argon2id.
   *
   * @param password - User password
   * @param salt - Random salt (16 bytes recommended)
   * @returns 32-byte session key
   * @throws {CryptoError} If key derivation fails
   */
  deriveSessionKey(password: string, salt: Uint8Array): Uint8Array {
    try {
      return this.getModule().VaultCrypto.derive_session_key(password, salt);
    } catch (e) {
      throw new CryptoError("Failed to derive session key", e);
    }
  }

  /**
   * Encrypts vault data using XChaCha20-Poly1305.
   *
   * @param data - Plaintext data to encrypt
   * @param password - Password for key derivation
   * @returns Encrypted blob (includes salt, nonce, ciphertext, tag)
   * @throws {CryptoError} If encryption fails
   */
  encryptVault(data: Uint8Array, password: string): Uint8Array {
    try {
      return this.getModule().VaultCrypto.encrypt_vault(data, password);
    } catch (e) {
      throw new CryptoError("Vault encryption failed", e);
    }
  }

  /**
   * Decrypts vault data using XChaCha20-Poly1305.
   *
   * @param encryptedData - Encrypted blob from encryptVault
   * @param password - Password used during encryption
   * @returns Decrypted plaintext data
   * @throws {CryptoError} If decryption fails (wrong password or corrupted data)
   */
  decryptVault(encryptedData: Uint8Array, password: string): Uint8Array {
    try {
      return this.getModule().VaultCrypto.decrypt_vault(
        encryptedData,
        password
      );
    } catch (e) {
      throw new CryptoError(
        "Vault decryption failed: Invalid password or corrupted data",
        e
      );
    }
  }

  // ============================================================================
  // Identity Operations (P47hClient)
  // ============================================================================

  /**
   * Creates a new cryptographic identity (Ed25519 keypair).
   *
   * @returns New P47hClientInstance with generated keypair
   * @throws {CryptoError} If identity generation fails
   */
  createIdentity(): P47hClientInstance {
    try {
      const wasm = this.getModule();
      return new wasm.P47hClient();
    } catch (e) {
      throw new CryptoError("Failed to generate new identity", e);
    }
  }

  /**
   * Restores an identity from encrypted secret bytes.
   *
   * @param wrappedSecret - Encrypted private key from export_wrapped_secret
   * @param sessionKey - Session key used during encryption
   * @returns Restored P47hClientInstance
   * @throws {CryptoError} If restoration fails
   */
  restoreIdentity(
    wrappedSecret: Uint8Array,
    sessionKey: Uint8Array
  ): P47hClientInstance {
    try {
      return this.getModule().P47hClient.from_wrapped_secret(
        wrappedSecret,
        sessionKey
      );
    } catch (e) {
      throw new CryptoError(
        "Failed to restore identity from wrapped secret",
        e
      );
    }
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Generates cryptographically secure random bytes.
   *
   * @param length - Number of random bytes to generate
   * @returns Uint8Array with random bytes
   */
  getRandomValues(length: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(length));
  }

  /**
   * Checks if the adapter has been initialized.
   * @returns True if init() has been called successfully
   */
  isInitialized(): boolean {
    return this._isInitialized;
  }
}
