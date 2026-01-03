/**
 * @fileoverview Unit tests for SecretManagementUseCase
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { SecretManagementUseCase } from '../../../src/application/use-cases/SecretManagementUseCase';
import { RegisterIdentityUseCase } from '../../../src/application/use-cases/RegisterIdentityUseCase';
import { SessionManager } from '../../../src/application/services/SessionManager';
import { NotAuthenticatedError, VaultError } from '../../../src/domain/errors';
import { MockStorage } from '../../mocks/MockStorage';
import { MockCryptoPort } from '../../mocks/MockCryptoPort';

describe('SecretManagementUseCase', () => {
  let secretsUseCase: SecretManagementUseCase;
  let registerUseCase: RegisterIdentityUseCase;
  let crypto: MockCryptoPort;
  let storage: MockStorage;
  let session: SessionManager;

  beforeEach(async () => {
    crypto = new MockCryptoPort();
    storage = new MockStorage();
    session = new SessionManager();
    
    secretsUseCase = new SecretManagementUseCase(crypto, storage, session);
    registerUseCase = new RegisterIdentityUseCase(crypto, storage, session);
  });

  describe('saveSecret', () => {
    it('should save secret to session cache and storage', async () => {
      await registerUseCase.execute({ password: 'test-password' });

      await secretsUseCase.saveSecret('api_key', 'super_secret');

      // Verify in session cache
      const cached = session.getSecret('api_key');
      assert.strictEqual(cached, 'super_secret');

      // Verify persisted (storage updated)
      const did = session.getDid();
      const stored = await storage.get(did);
      assert.ok(stored, 'Storage should have blob');
      assert.ok(stored?.updatedAt, 'Should update timestamp');
    });

    it('should throw NotAuthenticatedError when not logged in', async () => {
      await assert.rejects(
        async () => secretsUseCase.saveSecret('key', 'value'),
        NotAuthenticatedError,
        'Should throw NotAuthenticatedError'
      );
    });

    it('should encrypt secrets before persisting', async () => {
      await registerUseCase.execute({ password: 'test-password' });
      crypto.reset();

      await secretsUseCase.saveSecret('api_key', 'secret_value');

      assert.strictEqual(crypto.calls.decryptVault, 1, 'Should decrypt current vault');
      assert.strictEqual(crypto.calls.encryptVault, 1, 'Should re-encrypt with updated secrets');
    });

    it('should overwrite existing secret', async () => {
      await registerUseCase.execute({ password: 'test-password' });

      await secretsUseCase.saveSecret('api_key', 'value1');
      await secretsUseCase.saveSecret('api_key', 'value2');

      const value = secretsUseCase.getSecret('api_key');
      assert.strictEqual(value, 'value2');
    });
  });

  describe('getSecret', () => {
    it('should retrieve secret from session cache', async () => {
      await registerUseCase.execute({ password: 'test-password' });
      await secretsUseCase.saveSecret('api_key', 'secret_value');

      const value = secretsUseCase.getSecret('api_key');

      assert.strictEqual(value, 'secret_value');
    });

    it('should return null for non-existent secret', async () => {
      await registerUseCase.execute({ password: 'test-password' });

      const value = secretsUseCase.getSecret('nonexistent');

      assert.strictEqual(value, null);
    });

    it('should throw NotAuthenticatedError when not logged in', () => {
      assert.throws(
        () => secretsUseCase.getSecret('any'),
        NotAuthenticatedError,
        'Should throw NotAuthenticatedError'
      );
    });
  });

  describe('deleteSecret', () => {
    it('should remove secret from session and storage', async () => {
      await registerUseCase.execute({ password: 'test-password' });
      await secretsUseCase.saveSecret('api_key', 'secret_value');
      crypto.reset();

      await secretsUseCase.deleteSecret('api_key');

      const value = secretsUseCase.getSecret('api_key');
      assert.strictEqual(value, null);
      assert.strictEqual(crypto.calls.encryptVault, 1, 'Should persist deletion');
    });

    it('should not throw if secret does not exist', async () => {
      await registerUseCase.execute({ password: 'test-password' });

      // Should not throw
      await secretsUseCase.deleteSecret('nonexistent');
    });

    it('should throw NotAuthenticatedError when not logged in', async () => {
      await assert.rejects(
        async () => secretsUseCase.deleteSecret('any'),
        NotAuthenticatedError,
        'Should throw NotAuthenticatedError'
      );
    });
  });

  describe('listSecretKeys', () => {
    it('should return all secret keys', async () => {
      await registerUseCase.execute({ password: 'test-password' });
      await secretsUseCase.saveSecret('key1', 'value1');
      await secretsUseCase.saveSecret('key2', 'value2');
      await secretsUseCase.saveSecret('key3', 'value3');

      const keys = secretsUseCase.listSecretKeys();

      assert.deepStrictEqual(keys.sort(), ['key1', 'key2', 'key3']);
    });

    it('should return empty array when no secrets', async () => {
      await registerUseCase.execute({ password: 'test-password' });

      const keys = secretsUseCase.listSecretKeys();

      assert.deepStrictEqual(keys, []);
    });

    it('should throw NotAuthenticatedError when not logged in', () => {
      assert.throws(
        () => secretsUseCase.listSecretKeys(),
        NotAuthenticatedError,
        'Should throw NotAuthenticatedError'
      );
    });
  });
});
