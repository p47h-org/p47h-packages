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

  it('should persist encrypted vault to storage', async () => {
    const result = await useCase.execute({ password: 'test-password' });

    const stored = await storage.get(result.did);
    assert.ok(stored, 'Vault should be persisted');
    assert.strictEqual(stored?.did, result.did);
    assert.strictEqual(stored?.version, 2);
    assert.ok(stored?.wrappedData, 'Should have encrypted data');
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
    assert.strictEqual(crypto.calls.getRandomValues, 1, 'Should call getRandomValues once, for the salt');
    assert.strictEqual(crypto.calls.deriveSessionKey, 1, 'Should derive session key');
    assert.strictEqual(crypto.calls.encryptVault, 1, 'Should encrypt once, with the password');
  });

  it('should NOT create a second, recovery-encrypted blob', async () => {
    const result = await useCase.execute({ password: 'test-password' });

    const stored = await storage.get(result.did);
    assert.ok(stored?.wrappedData, 'Should have password-encrypted blob');
    assert.strictEqual(
      (stored as Record<string, unknown>)['recoveryBlob'],
      undefined,
      'a recovery blob is a second offline-attack oracle for the same data'
    );
    assert.strictEqual(crypto.calls.encryptVault, 1, 'Should encrypt exactly once');
  });
});
