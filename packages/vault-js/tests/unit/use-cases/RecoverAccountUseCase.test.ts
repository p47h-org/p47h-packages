/**
 * @fileoverview Unit tests for RecoverAccountUseCase
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { RecoverAccountUseCase } from '../../../src/application/use-cases/RecoverAccountUseCase';
import { RegisterIdentityUseCase } from '../../../src/application/use-cases/RegisterIdentityUseCase';
import { SessionManager } from '../../../src/application/services/SessionManager';
import { AuthenticationError, VaultError } from '../../../src/domain/errors';
import { MockStorage } from '../../mocks/MockStorage';
import { MockCryptoPort } from '../../mocks/MockCryptoPort';

describe('RecoverAccountUseCase', () => {
  let recoverUseCase: RecoverAccountUseCase;
  let registerUseCase: RegisterIdentityUseCase;
  let crypto: MockCryptoPort;
  let storage: MockStorage;
  let session: SessionManager;

  beforeEach(async () => {
    crypto = new MockCryptoPort();
    storage = new MockStorage();
    session = new SessionManager();
    
    recoverUseCase = new RecoverAccountUseCase(crypto, storage);
    registerUseCase = new RegisterIdentityUseCase(crypto, storage, session);
  });

  it('should recover account with valid recovery code', async () => {
    const { did, recoveryCode } = await registerUseCase.execute({ password: 'old-password' });
    session.clear();
    crypto.reset();

    const result = await recoverUseCase.execute({
      recoveryCode,
      newPassword: 'new-password'
    });

    assert.strictEqual(result.did, did);
    assert.strictEqual(result.newRecoveryCode, undefined, 'Should not rotate code by default');
  });

  it('should re-encrypt vault with new password', async () => {
    const { did, recoveryCode } = await registerUseCase.execute({ password: 'old-password' });
    session.clear();
    crypto.reset();

    await recoverUseCase.execute({
      recoveryCode,
      newPassword: 'new-password'
    });

    const updatedBlob = await storage.get(did);
    assert.ok(updatedBlob, 'Vault should still exist');
    // Verify crypto operations were called
    assert.strictEqual(crypto.calls.decryptVault, 1, 'Should decrypt with recovery code');
    assert.strictEqual(crypto.calls.encryptVault, 1, 'Should re-encrypt with new password');
  });

  it('should rotate recovery code when requested', async () => {
    const { did, recoveryCode } = await registerUseCase.execute({ password: 'old-password' });
    session.clear();
    crypto.reset();

    const result = await recoverUseCase.execute({
      recoveryCode,
      newPassword: 'new-password',
      rotateRecoveryCode: true
    });

    assert.ok(result.newRecoveryCode, 'Should return new recovery code');
    assert.match(
      result.newRecoveryCode!,
      /^RK-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}$/,
      'New recovery code should match format'
    );

    // Verify that recovery blob was re-encrypted (2 encrypts: main + recovery)
    assert.strictEqual(crypto.calls.encryptVault, 2, 'Should encrypt both main and recovery blobs');
  });

  it('should throw AuthenticationError for invalid recovery code', async () => {
    await registerUseCase.execute({ password: 'test-password' });
    session.clear();
    crypto.shouldFailDecrypt = true;

    await assert.rejects(
      async () => recoverUseCase.execute({
        recoveryCode: 'RK-INVALID-CODE-1234-5678',
        newPassword: 'new-password'
      }),
      AuthenticationError,
      'Should throw AuthenticationError for invalid code'
    );
  });

  it('should throw AuthenticationError if no vaults exist', async () => {
    await assert.rejects(
      async () => recoverUseCase.execute({
        recoveryCode: 'RK-12345678-12345678-12345678-12345678',
        newPassword: 'new-password'
      }),
      AuthenticationError,
      'Should throw AuthenticationError when no vaults found'
    );
  });

  it('should throw VaultError if recovery blob is missing', async () => {
    // Create vault without recovery blob (simulating old SDK)
    const blob = {
      version: 1,
      did: 'did:p47h:old-vault',
      salt: btoa('salt'),
      wrappedData: btoa('encrypted'),
      updatedAt: Date.now()
      // No recoveryBlob!
    };
    await storage.save('did:p47h:old-vault', blob);

    await assert.rejects(
      async () => recoverUseCase.execute({
        recoveryCode: 'RK-12345678-12345678-12345678-12345678',
        newPassword: 'new-password',
        did: 'did:p47h:old-vault'
      }),
      VaultError,
      'Should throw VaultError when recovery unavailable'
    );
  });

  it('should use specific DID when provided', async () => {
    const { did } = await registerUseCase.execute({ password: 'password1' });
    // Create second identity
    session.clear();
    const second = await registerUseCase.execute({ password: 'password2' });
    session.clear();
    crypto.reset();

    const result = await recoverUseCase.execute({
      recoveryCode: second.recoveryCode,
      newPassword: 'new-password',
      did: second.did
    });

    assert.strictEqual(result.did, second.did);
  });
});
