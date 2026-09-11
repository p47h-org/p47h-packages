/**
 * @fileoverview Mock Crypto Port for testing
 * @license Apache-2.0
 *
 * Implements ICryptoPort for unit testing use cases.
 *
 * ## Honesty contract
 *
 * This mock is a TOY cipher, but it is a FAITHFUL MODEL of the real one in the
 * only respect that matters for correctness tests: **every operation is bound to
 * the key material it is supposed to be bound to, and fails when that material
 * does not match.**
 *
 * Specifically:
 *
 * - `deriveSessionKey(password, salt)` is a function of the WHOLE password and
 *   the WHOLE salt. Different passwords produce different keys.
 * - `encryptVault` prepends a key-derived tag; `decryptVault` verifies it and
 *   throws on mismatch (models AEAD authentication failure).
 * - `export_wrapped_secret(sessionKey)` binds the wrapped blob to the FULL
 *   session key; `restoreIdentity` verifies it and throws on mismatch.
 *
 * A previous version of this mock ignored these parameters and returned a valid
 * result unconditionally. That is why the recovery flow shipped with a P0
 * data-loss bug despite green tests and mutation testing: the oracle was blind,
 * so there was nothing for the mutants to kill.
 *
 * **Do not "simplify" this mock by dropping the key checks.** If a test needs an
 * operation to succeed, give it matching key material — do not make the mock
 * incapable of failing.
 */

import type { ICryptoPort, ICryptoClient } from '../../src/application/ports/ICryptoPort';

// ---------------------------------------------------------------------------
// Deterministic toy KDF / keystream helpers
// ---------------------------------------------------------------------------

/** FNV-1a over bytes, used as the seed of the toy expansion. */
function fnv1a(bytes: Uint8Array, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function toBytes(input: string | Uint8Array): Uint8Array {
  return typeof input === 'string' ? new TextEncoder().encode(input) : input;
}

/** Deterministic 32-byte expansion of arbitrary input. Not cryptographic. */
function expand32(...parts: Array<string | Uint8Array>): Uint8Array {
  const joined: number[] = [];
  for (const p of parts) {
    joined.push(...toBytes(p), 0x1f); // 0x1f separates parts unambiguously
  }
  const base = new Uint8Array(joined);
  const out = new Uint8Array(32);
  let h = fnv1a(base);
  for (let i = 0; i < 32; i++) {
    h = Math.imul(h ^ (i + 1), 0x01000193) >>> 0;
    out[i] = (h >>> 24) & 0xff;
  }
  return out;
}

/** 8-byte tag identifying a key. Used to model authentication. */
function tag8(key: Uint8Array): Uint8Array {
  return expand32(key, 'tag').slice(0, 8);
}

/** XOR a payload with a keystream derived from `key`. Involutive. */
function xorStream(data: Uint8Array, key: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const k = expand32(key, `ks${i >> 5}`);
    out[i] = data[i]! ^ k[i & 31]!;
  }
  return out;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Mock client
// ---------------------------------------------------------------------------

/**
 * Mock crypto client. Holds a deterministic "private key" derived from its DID,
 * so that wrapping and unwrapping can be checked for consistency.
 */
class MockCryptoClient implements ICryptoClient {
  /** Stand-in for the Ed25519 secret. Never leaves this class unwrapped. */
  private readonly secret: Uint8Array;

  constructor(private readonly did: string = 'did:p47h:mock-identity') {
    this.secret = expand32(did, 'identity-secret');
  }

  get_did(): string {
    return this.did;
  }

  get_public_key(): Uint8Array {
    return expand32(this.did, 'pub').slice(0, 8);
  }

  /**
   * Wraps the secret under `sessionKey`.
   *
   * Layout: [tag8(sessionKey) || xorStream(secret, sessionKey)]
   * The tag binds the blob to the exact key that produced it.
   */
  export_wrapped_secret(sessionKey: Uint8Array): Uint8Array {
    const body = xorStream(this.secret, sessionKey);
    const out = new Uint8Array(8 + body.length);
    out.set(tag8(sessionKey), 0);
    out.set(body, 8);
    return out;
  }

  sign_data(data: Uint8Array): Uint8Array {
    return new Uint8Array([...data].reverse());
  }

  free(): void {
    // No-op
  }
}

// ---------------------------------------------------------------------------
// Mock port
// ---------------------------------------------------------------------------

export class MockCryptoPort implements ICryptoPort {
  /** Call counters, for tests that assert on interactions. */
  public calls = {
    init: 0,
    createIdentity: 0,
    restoreIdentity: 0,
    deriveSessionKey: 0,
    encryptVault: 0,
    decryptVault: 0,
    getRandomValues: 0,
  };

  /** Forces the next decryptVault to fail, regardless of key material. */
  public shouldFailDecrypt = false;

  /**
   * Legacy hook: when set, decryptVault rejects any other password.
   *
   * Redundant now that the mock binds the password properly — kept so existing
   * tests keep compiling. Prefer relying on the real key check.
   */
  public decryptPassword = '';

  async init(_licenseKey?: string): Promise<void> {
    this.calls.init++;
  }

  createIdentity(): ICryptoClient {
    this.calls.createIdentity++;
    return new MockCryptoClient();
  }

  /**
   * Unwraps an identity. Throws unless `sessionKey` is the key that wrapped it.
   *
   * This is the check whose absence hid the recovery bug (F-01): recovery
   * re-encrypts the OUTER container under the new password but leaves
   * `wrappedSecret` bound to a key derived from the OLD one, so this call is
   * exactly where the real WASM core fails.
   */
  restoreIdentity(wrappedSecret: Uint8Array, sessionKey: Uint8Array): ICryptoClient {
    this.calls.restoreIdentity++;

    if (wrappedSecret.length < 8) {
      throw new Error('Failed to restore identity from wrapped secret: blob too short');
    }

    const expected = tag8(sessionKey);
    const actual = wrappedSecret.slice(0, 8);
    if (!sameBytes(expected, actual)) {
      throw new Error(
        'Failed to restore identity from wrapped secret: session key does not match'
      );
    }

    const secret = xorStream(wrappedSecret.slice(8), sessionKey);
    const did = secret.length === 32 ? 'did:p47h:mock-identity' : 'did:p47h:unknown';
    return new MockCryptoClient(did);
  }

  /** Derives a session key from the WHOLE password and the WHOLE salt. */
  deriveSessionKey(password: string, salt: Uint8Array): Uint8Array {
    this.calls.deriveSessionKey++;
    return expand32(password, salt, 'session');
  }

  /** Encrypts under `password`. Layout: [tag8(k) || xorStream(data, k)]. */
  encryptVault(data: Uint8Array, password: string): Uint8Array {
    this.calls.encryptVault++;
    const k = expand32(password, 'vault');
    const body = xorStream(data, k);
    const out = new Uint8Array(8 + body.length);
    out.set(tag8(k), 0);
    out.set(body, 8);
    return out;
  }

  /** Decrypts under `password`. Throws on tag mismatch (models AEAD failure). */
  decryptVault(blob: Uint8Array, password: string): Uint8Array {
    this.calls.decryptVault++;

    if (this.shouldFailDecrypt) {
      throw new Error('Decryption failed');
    }
    if (this.decryptPassword && password !== this.decryptPassword) {
      throw new Error('Decryption failed');
    }
    if (blob.length < 8) {
      throw new Error('Decryption failed: blob too short');
    }

    const k = expand32(password, 'vault');
    if (!sameBytes(tag8(k), blob.slice(0, 8))) {
      throw new Error('Decryption failed: wrong password or corrupted data');
    }

    return xorStream(blob.slice(8), k);
  }

  getRandomValues(length: number): Uint8Array {
    this.calls.getRandomValues++;
    // Deterministic, but varies per call so distinct salts are distinct.
    const seq = this.calls.getRandomValues;
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      out[i] = expand32(`rnd${seq}`, `b${i >> 5}`)[i & 31]!;
    }
    return out;
  }

  reset(): void {
    this.calls = {
      init: 0,
      createIdentity: 0,
      restoreIdentity: 0,
      deriveSessionKey: 0,
      encryptVault: 0,
      decryptVault: 0,
      getRandomValues: 0,
    };
    this.shouldFailDecrypt = false;
    this.decryptPassword = '';
  }
}
