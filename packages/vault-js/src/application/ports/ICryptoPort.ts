/**
 * @fileoverview Crypto Port Interface
 * 
 * Defines the contract for cryptographic operations.
 * This port allows different crypto implementations to be injected.
 * 
 * @module application/ports/ICryptoPort
 * @license Apache-2.0
 */

/**
 * Instance of a cryptographic identity client.
 */
export interface ICryptoClient {
  /** Returns the Decentralized Identifier (DID) for this identity */
  get_did(): string;
  /** Returns the raw Ed25519 public key bytes (32 bytes) */
  get_public_key(): Uint8Array;
  /** Exports the private key encrypted with session key */
  export_wrapped_secret(sessionKey: Uint8Array): Uint8Array;
  /** Signs arbitrary data with the private key */
  sign_data(data: Uint8Array): Uint8Array;
  /** Frees the memory associated with this client */
  free(): void;
}

/**
 * Port interface for cryptographic operations.
 * Implemented by WasmCryptoAdapter.
 */
export interface ICryptoPort {
  /**
   * Initializes the crypto module.
   */
  init(): Promise<void>;

  /**
   * Creates a new cryptographic identity.
   */
  createIdentity(): ICryptoClient;

  /**
   * Restores an identity from wrapped secret.
   */
  restoreIdentity(wrappedSecret: Uint8Array, sessionKey: Uint8Array): ICryptoClient;

  /**
   * Derives a session key from password and salt using Argon2id.
   */
  deriveSessionKey(password: string, salt: Uint8Array): Uint8Array;

  /**
   * Encrypts vault data with password.
   */
  encryptVault(data: Uint8Array, password: string): Uint8Array;

  /**
   * Decrypts vault data with password.
   */
  decryptVault(blob: Uint8Array, password: string): Uint8Array;

  /**
   * Generates cryptographically secure random bytes.
   */
  getRandomValues(length: number): Uint8Array;
}
