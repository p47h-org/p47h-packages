/**
 * @fileoverview Mock Crypto Port for testing
 * @license Apache-2.0
 * 
 * Implements ICryptoPort interface for unit testing use cases.
 */

import type { ICryptoPort, ICryptoClient } from '../../src/application/ports/ICryptoPort';

/**
 * Mock crypto client for testing.
 */
class MockCryptoClient implements ICryptoClient {
  constructor(private readonly did: string = 'did:p47h:mock-identity') {}

  get_did(): string {
    return this.did;
  }

  get_public_key(): Uint8Array {
    return new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  }

  export_wrapped_secret(_sessionKey: Uint8Array): Uint8Array {
    return new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD]);
  }

  sign_data(data: Uint8Array): Uint8Array {
    // Mock signature: reverse the input
    return new Uint8Array([...data].reverse());
  }

  free(): void {
    // No-op
  }
}

/**
 * Mock implementation of ICryptoPort for unit testing.
 */
export class MockCryptoPort implements ICryptoPort {
  // Track calls for assertions
  public calls = {
    init: 0,
    createIdentity: 0,
    restoreIdentity: 0,
    deriveSessionKey: 0,
    encryptVault: 0,
    decryptVault: 0,
    getRandomValues: 0,
  };

  // Configure mock behavior
  public shouldFailDecrypt = false;
  public decryptPassword = ''; // Expected password for decrypt

  async init(_licenseKey?: string): Promise<void> {
    this.calls.init++;
  }

  createIdentity(): ICryptoClient {
    this.calls.createIdentity++;
    return new MockCryptoClient();
  }

  restoreIdentity(_wrappedSecret: Uint8Array, _sessionKey: Uint8Array): ICryptoClient {
    this.calls.restoreIdentity++;
    return new MockCryptoClient();
  }

  deriveSessionKey(_password: string, _salt: Uint8Array): Uint8Array {
    this.calls.deriveSessionKey++;
    return new Uint8Array(32).fill(0x42);
  }

  encryptVault(data: Uint8Array, _password: string): Uint8Array {
    this.calls.encryptVault++;
    // Simple XOR encryption for testing
    return data.map(b => b ^ 0xFF);
  }

  decryptVault(blob: Uint8Array, password: string): Uint8Array {
    this.calls.decryptVault++;
    if (this.shouldFailDecrypt || (this.decryptPassword && password !== this.decryptPassword)) {
      throw new Error('Decryption failed');
    }
    // Simple XOR decryption for testing
    return blob.map(b => b ^ 0xFF);
  }

  getRandomValues(length: number): Uint8Array {
    this.calls.getRandomValues++;
    // Deterministic for testing
    return new Uint8Array(length).fill(0x42);
  }

  // Test helpers
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
