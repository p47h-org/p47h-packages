/**
 * @fileoverview Unit tests for LoginUseCase
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { LoginUseCase } from '../../../src/application/use-cases/LoginUseCase';
import { RegisterIdentityUseCase } from '../../../src/application/use-cases/RegisterIdentityUseCase';
import { SessionManager } from '../../../src/application/services/SessionManager';
import { AuthenticationError, VaultError } from '../../../src/domain/errors';
import { MockStorage } from '../../mocks/MockStorage';
import { MockCryptoPort } from '../../mocks/MockCryptoPort';

describe('LoginUseCase', () => {
  let loginUseCase: LoginUseCase;
  let registerUseCase: RegisterIdentityUseCase;
  let crypto: MockCryptoPort;
  let storage: MockStorage;
  let session: SessionManager;

  beforeEach(async () => {
    crypto = new MockCryptoPort();
    storage = new MockStorage();
    session = new SessionManager();
    
    loginUseCase = new LoginUseCase(crypto, storage, session);
    registerUseCase = new RegisterIdentityUseCase(crypto, storage, session);
  });

  it('should login with correct password', async () => {
    // Setup: Register first
    const { did } = await registerUseCase.execute({ password: 'test-password' });
    session.clear(); // Logout
    crypto.reset();

    // Act
    const result = await loginUseCase.execute({ password: 'test-password', did });

    // Assert
    assert.strictEqual(result.did, did);
    assert.ok(result.publicKey, 'Should return public key');
    assert.strictEqual(session.isAuthenticated(), true);
  });

  it('should auto-select first identity if DID not specified', async () => {
    await registerUseCase.execute({ password: 'test-password' });
    session.clear();
    crypto.reset();

    const result = await loginUseCase.execute({ password: 'test-password' });

    assert.strictEqual(result.did, 'did:p47h:mock-identity');
    assert.strictEqual(session.isAuthenticated(), true);
  });

  it('should throw AuthenticationError for wrong password', async () => {
    await registerUseCase.execute({ password: 'test-password' });
    session.clear();
    crypto.shouldFailDecrypt = true;

    await assert.rejects(
      async () => loginUseCase.execute({ password: 'wrong-password' }),
      AuthenticationError,
      'Should throw AuthenticationError'
    );
  });

  it('should throw AuthenticationError if no identities exist', async () => {
    await assert.rejects(
      async () => loginUseCase.execute({ password: 'any' }),
      AuthenticationError,
      'Should throw AuthenticationError when no identities found'
    );
  });

  it('should throw AuthenticationError if DID not found', async () => {
    await registerUseCase.execute({ password: 'test-password' });
    session.clear();

    await assert.rejects(
      async () => loginUseCase.execute({ password: 'test-password', did: 'did:p47h:nonexistent' }),
      AuthenticationError,
      'Should throw AuthenticationError for non-existent DID'
    );
  });

  it('should restore secrets from storage on login', async () => {
    // Register and add a secret
    await registerUseCase.execute({ password: 'test-password' });
    session.setSecret('api_key', 'secret_value');
    
    // Manually update storage with secret (simulating saveSecret)
    const did = session.getDid();
    const stored = await storage.get(did);
    if (stored) {
      // Update the encrypted data to include the secret
      const internalData = {
        did,
        wrappedSecret: 'mock',
        salt: 'mock',
        secrets: { api_key: 'secret_value' },
        createdAt: Date.now(),
      };
      const encrypted = crypto.encryptVault(
        new TextEncoder().encode(JSON.stringify(internalData)),
        'test-password'
      );
      stored.wrappedData = btoa(String.fromCharCode(...encrypted));
      await storage.save(did, stored);
    }
    
    session.clear();
    crypto.reset();

    // Login and verify secrets restored
    await loginUseCase.execute({ password: 'test-password' });
    
    const restoredSecret = session.getSecret('api_key');
    assert.strictEqual(restoredSecret, 'secret_value');
  });

  it('should call crypto adapter methods correctly', async () => {
    await registerUseCase.execute({ password: 'test-password' });
    session.clear();
    crypto.reset();

    await loginUseCase.execute({ password: 'test-password' });

    assert.strictEqual(crypto.calls.decryptVault, 1, 'Should decrypt vault once');
    assert.strictEqual(crypto.calls.deriveSessionKey, 1, 'Should derive session key');
    assert.strictEqual(crypto.calls.restoreIdentity, 1, 'Should restore identity');
  });
});
