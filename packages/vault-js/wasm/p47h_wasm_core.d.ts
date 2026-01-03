/* tslint:disable */
/* eslint-disable */

export class P47hClient {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Generates a new cryptographic identity using browser's secure random source
   */
  constructor();
  /**
   * Reconstructs identity from previously exported secret bytes
   */
  static from_secret(secret_bytes: Uint8Array): P47hClient;
  /**
   * Exports the private key encrypted with ChaCha20Poly1305
   *
   * # Security
   *
   * This method encrypts the private key using ChaCha20Poly1305 AEAD cipher
   * before exporting it. The caller must provide a 32-byte session key.
   *
   * # Arguments
   *
   * * `session_key` - A 32-byte key derived from user password or other secure source
   *
   * # Returns
   *
   * Returns a byte array containing: [nonce(12 bytes) || ciphertext || tag(16 bytes)]
   *
   * # Example
   *
   * ```javascript
   * // Derive session key from password using PBKDF2 or similar
   * const sessionKey = await deriveKey(password);
   * const wrapped = client.export_wrapped_secret(sessionKey);
   * // Store wrapped securely in IndexedDB
   * ```
   */
  export_wrapped_secret(session_key: Uint8Array): Uint8Array;
  /**
   * Imports identity from encrypted secret
   *
   * # Arguments
   *
   * * `wrapped` - The encrypted secret from `export_wrapped_secret`
   * * `session_key` - The same 32-byte key used for encryption
   *
   * # Returns
   *
   * Returns a new `P47hClient` instance with the decrypted identity
   *
   * # Example
   *
   * ```javascript
   * const sessionKey = await deriveKey(password);
   * const client = P47hClient.from_wrapped_secret(wrapped, sessionKey);
   * ```
   */
  static from_wrapped_secret(wrapped: Uint8Array, session_key: Uint8Array): P47hClient;
  /**
   * Returns the Decentralized Identifier (DID) for this identity
   */
  get_did(): string;
  /**
   * Returns the raw public key bytes (for advanced use cases)
   */
  get_public_key(): Uint8Array;
  /**
   * Signs a challenge for authentication with the server
   */
  sign_challenge(challenge: Uint8Array): Uint8Array;
  /**
   * Signs arbitrary data (for advanced use cases)
   */
  sign_data(data: Uint8Array): Uint8Array;
  /**
   * Evaluates a policy request locally without server round-trip
   */
  evaluate_request(policy_toml: string, resource: string, action: string): any;
  /**
   * Batch evaluation of multiple requests (more efficient)
   */
  evaluate_batch(policy_toml: string, requests_json: string): any;
}

export class VaultCrypto {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Encrypts data using XChaCha20Poly1305 with a key derived from Argon2id
   * Output format: [MAGIC_BYTES (13)] [SALT (16)] [NONCE (24)] [CIPHERTEXT]
   */
  static encrypt_vault(data: Uint8Array, password: string): Uint8Array;
  /**
   * Decrypts a vault blob
   */
  static decrypt_vault(blob: Uint8Array, password: string): Uint8Array;
  /**
   * Derives a session key from password and salt
   */
  static derive_session_key(password: string, salt: Uint8Array): Uint8Array;
}

export class WasmIdentity {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Generate a new identity
   */
  constructor();
  /**
   * Get the public key hash as hex string
   */
  publicKeyHash(): string;
  /**
   * Get the DID (Decentralized Identifier)
   */
  getDid(): string;
}

export class WasmPolicy {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Create a new policy
   */
  constructor(name: string, ttl_seconds: bigint);
  /**
   * Add a rule to the policy
   */
  addRule(peer_id: string, action: string, resource: string): void;
  /**
   * Get number of rules
   */
  ruleCount(): number;
  /**
   * Get the Merkle root hash of the policy
   *
   * Calculates the hash of the canonical TOML representation of the policy.
   * This serves as the Merkle root for synchronization verification.
   */
  getRootHash(): string;
  /**
   * Get policy name
   */
  readonly name: string;
}

/**
 * Initialize the WASM module (sets panic hook for debugging)
 */
export function init(): void;

/**
 * Validates a policy TOML string
 *
 * Checks if the provided string is a valid P47H policy.
 * Returns Ok(()) if valid, or an error message if invalid.
 */
export function validate_policy(policy_toml: string): void;

/**
 * Validates a policy TOML string with precise error reporting
 */
export function validate_policy_detailed(policy_toml: string): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly init: () => void;
  readonly __wbg_p47hclient_free: (a: number, b: number) => void;
  readonly p47hclient_generate_new: (a: number) => void;
  readonly p47hclient_from_secret: (a: number, b: number, c: number) => void;
  readonly p47hclient_export_wrapped_secret: (a: number, b: number, c: number, d: number) => void;
  readonly p47hclient_from_wrapped_secret: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly p47hclient_get_did: (a: number, b: number) => void;
  readonly p47hclient_get_public_key: (a: number, b: number) => void;
  readonly p47hclient_sign_challenge: (a: number, b: number, c: number, d: number) => void;
  readonly p47hclient_evaluate_request: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
  readonly p47hclient_evaluate_batch: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  readonly validate_policy: (a: number, b: number, c: number) => void;
  readonly validate_policy_detailed: (a: number, b: number, c: number) => void;
  readonly __wbg_vaultcrypto_free: (a: number, b: number) => void;
  readonly vaultcrypto_encrypt_vault: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly vaultcrypto_decrypt_vault: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly vaultcrypto_derive_session_key: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly wasmidentity_new: (a: number) => void;
  readonly wasmidentity_publicKeyHash: (a: number, b: number) => void;
  readonly wasmidentity_getDid: (a: number, b: number) => void;
  readonly __wbg_wasmpolicy_free: (a: number, b: number) => void;
  readonly wasmpolicy_new: (a: number, b: number, c: number, d: bigint) => void;
  readonly wasmpolicy_addRule: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
  readonly wasmpolicy_name: (a: number, b: number) => void;
  readonly wasmpolicy_ruleCount: (a: number) => number;
  readonly wasmpolicy_getRootHash: (a: number, b: number) => void;
  readonly p47hclient_sign_data: (a: number, b: number, c: number, d: number) => void;
  readonly __wbg_wasmidentity_free: (a: number, b: number) => void;
  readonly __wbindgen_export: (a: number, b: number) => number;
  readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export3: (a: number) => void;
  readonly __wbindgen_export4: (a: number, b: number, c: number) => void;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
