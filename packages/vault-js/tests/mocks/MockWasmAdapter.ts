import { WasmCryptoAdapter, type P47hClientInstance, type LicenseStatus } from '../../src/adapters/WasmCryptoAdapter';

// Mock de la identidad (P47hClient)
class MockClient implements P47hClientInstance {
  constructor(private did: string) {}

  get_did(): string {
    return this.did;
  }

  get_public_key(): Uint8Array {
    return new Uint8Array([1, 2, 3]); // Mock key
  }

  export_wrapped_secret(sessionKey: Uint8Array): Uint8Array {
    // Simulamos exportación: devolvemos "secret" + sessionKey[0]
    return new Uint8Array([0xAA, 0xBB, sessionKey[0]]); 
  }

  sign_data(data: Uint8Array): Uint8Array {
    // Firma simulada: data invertida
    return new Uint8Array([...data].reverse());
  }

  free(): void {
    // No-op
  }
}

export class MockWasmAdapter extends WasmCryptoAdapter {
  // Sobrescribimos init para no cargar WASM real
  async init(licenseKey?: string): Promise<LicenseStatus> {
    return Promise.resolve({
      isCommercial: false,
      licensee: null
    });
  }

  getRandomValues(length: number): Uint8Array {
    // Determinista para tests: llena con 42
    return new Uint8Array(length).fill(42);
  }

  deriveSessionKey(password: string, salt: Uint8Array): Uint8Array {
    // Fake KDF: password bytes + salt[0]
    const key = new TextEncoder().encode(password);
    const result = new Uint8Array(32);
    result.set(key.slice(0, 32));
    result[31] = salt[0];
    return result;
  }

  encryptVault(data: Uint8Array, password: string): Uint8Array {
    // Fake Encrypt: XOR con 0xFF (simple ofuscación reversible)
    return data.map(b => b ^ 0xFF);
  }

  decryptVault(encryptedData: Uint8Array, password: string): Uint8Array {
    // Fake Decrypt: XOR con 0xFF (reversible)
    // En un test real de fallo, lanzaríamos error si password es incorrecto
    if (password === 'wrong') throw new Error('Decryption failed');
    return encryptedData.map(b => b ^ 0xFF);
  }

  createIdentity(): P47hClientInstance {
    return new MockClient('did:p47h:mock-identity');
  }

  restoreIdentity(wrappedSecret: Uint8Array, sessionKey: Uint8Array): P47hClientInstance {
    return new MockClient('did:p47h:mock-identity');
  }
}