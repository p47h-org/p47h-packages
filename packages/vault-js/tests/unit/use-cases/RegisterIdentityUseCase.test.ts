/**
 * @fileoverview Unit tests for RegisterIdentityUseCase
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { RegisterIdentityUseCase } from '../../../src/application/use-cases/RegisterIdentityUseCase';
import { SessionManager } from '../../../src/application/services/SessionManager';
import { MockStorage } from '../../mocks/MockStorage';
import { MockCryptoPort } from '../../mocks/MockCryptoPort';

describe('RegisterIdentityUseCase', () => {
  let useCase: RegisterIdentityUseCase;
  let crypto: MockCryptoPort;
  let storage: MockStorage;
  let session: SessionManager;

  beforeEach(() => {
    crypto = new MockCryptoPort();
    storage = new MockStorage();
    session = new SessionManager();
    useCase = new RegisterIdentityUseCase(crypto, storage, session);
  });

  it('should generate a new identity and return DID', async () => {
    const result = await useCase.execute({ password: 'test-password' });

    assert.ok(result.did, 'Should return a DID');
    assert.strictEqual(result.did, 'did:p47h:mock-identity');
  });

  it('should generate a recovery code in correct format', async () => {
    const result = await useCase.execute({ password: 'test-password' });

    assert.ok(result.recoveryCode, 'Should return a recovery code');
    assert.match(
      result.recoveryCode,
      /^RK-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}$/,
      'Recovery code should match format RK-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX'
    );
  });

  it('should persist encrypted vault to storage', async () => {
    const result = await useCase.execute({ password: 'test-password' });

    const stored = await storage.get(result.did);
    assert.ok(stored, 'Vault should be persisted');
    assert.strictEqual(stored?.did, result.did);
    assert.strictEqual(stored?.version, 1);
    assert.ok(stored?.wrappedData, 'Should have encrypted data');
    assert.ok(stored?.recoveryBlob, 'Should have recovery blob');
  });

  it('should establish authenticated session after registration', async () => {
    assert.strictEqual(session.isAuthenticated(), false, 'Should not be authenticated initially');

    await useCase.execute({ password: 'test-password' });

    assert.strictEqual(session.isAuthenticated(), true, 'Should be authenticated after registration');
    assert.strictEqual(session.getDid(), 'did:p47h:mock-identity');
  });

  it('should call crypto adapter methods correctly', async () => {
    await useCase.execute({ password: 'test-password' });

    assert.strictEqual(crypto.calls.createIdentity, 1, 'Should call createIdentity once');
    assert.strictEqual(crypto.calls.getRandomValues, 2, 'Should call getRandomValues for salt and recovery code');
    assert.strictEqual(crypto.calls.deriveSessionKey, 1, 'Should derive session key');
    assert.strictEqual(crypto.calls.encryptVault, 2, 'Should encrypt with password and recovery code');
  });

  it('should create both password and recovery encrypted blobs', async () => {
    const result = await useCase.execute({ password: 'test-password' });
    
    const stored = await storage.get(result.did);
    assert.ok(stored?.wrappedData, 'Should have password-encrypted blob');
    assert.ok(stored?.recoveryBlob, 'Should have recovery-encrypted blob');
    // Note: With deterministic mock, blobs may be similar.
    // In production, different keys produce different ciphertext.
    assert.strictEqual(crypto.calls.encryptVault, 2, 'Should encrypt twice (password + recovery)');
  });
});
