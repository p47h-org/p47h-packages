/**
 * @fileoverview Integration tests for VaultFacade
 * 
 * Tests the complete vault workflow with mocked adapters.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { VaultFacade } from '../../src/logic/VaultFacade';
import { MockStorage } from '../mocks/MockStorage';
import { MockWasmAdapter } from '../mocks/MockWasmAdapter';
import { 
  AuthenticationError, 
  NotAuthenticatedError,
  InitializationError 
} from '../../src/domain/errors';

describe('VaultFacade (Integration)', () => {
  let vault: VaultFacade;
  let storage: MockStorage;
  let crypto: MockWasmAdapter;

  beforeEach(async () => {
    storage = new MockStorage();
    crypto = new MockWasmAdapter();
    vault = new VaultFacade(storage);
    
    // Inject mock crypto adapter
    (vault as any)._crypto = crypto;

    await vault.init();
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      assert.ok(vault, 'Vault should be created');
    });

    it('should be idempotent', async () => {
      await vault.init(); // Second init should not throw
      await vault.init(); // Third init should not throw
    });

    it('should throw if not initialized', async () => {
      const uninitVault = new VaultFacade(storage);
      
      await assert.rejects(
        async () => uninitVault.register('password'),
        InitializationError
      );
    });
  });

  describe('Identity Lifecycle', () => {
    it('should register a new identity', async () => {
      const { did, recoveryCode } = await vault.register('password123');

      assert.ok(did, 'Should return DID');
      assert.ok(recoveryCode, 'Should return recovery code');
      assert.match(did, /^did:p47h:/, 'DID should have correct prefix');
    });

    it('should be authenticated after registration', async () => {
      await vault.register('password123');

      assert.strictEqual(vault.isAuthenticated(), true);
    });

    it('should login with correct password', async () => {
      const { did } = await vault.register('password123');
      vault.lock();
      
      const identity = await vault.login('password123');

      assert.strictEqual(identity.did, did);
      assert.strictEqual(vault.isAuthenticated(), true);
    });

    it('should fail login with wrong password', async () => {
      await vault.register('password123');
      vault.lock();

      await assert.rejects(
        async () => vault.login('wrong'),
        AuthenticationError
      );
    });

    it('should lock and clear session', async () => {
      await vault.register('password123');
      vault.lock();

      assert.strictEqual(vault.isAuthenticated(), false);
    });

    it('should get DID when authenticated', async () => {
      const { did } = await vault.register('password123');

      assert.strictEqual(vault.getDid(), did);
    });

    it('should throw when getting DID while locked', async () => {
      await vault.register('password123');
      vault.lock();

      assert.throws(
        () => vault.getDid(),
        NotAuthenticatedError
      );
    });
  });

  describe('Secret Management', () => {
    beforeEach(async () => {
      await vault.register('password123');
    });

    it('should save and retrieve a secret', async () => {
      await vault.saveSecret('api_key', 'super_secret_value');
      
      const value = await vault.getSecret('api_key');
      assert.strictEqual(value, 'super_secret_value');
    });

    it('should return null for non-existent secret', async () => {
      const value = await vault.getSecret('nonexistent');
      assert.strictEqual(value, null);
    });

    it('should persist secrets across lock/unlock', async () => {
      await vault.saveSecret('api_key', 'secret_value');
      const did = vault.getDid();
      vault.lock();

      await vault.login('password123', did);

      const value = await vault.getSecret('api_key');
      assert.strictEqual(value, 'secret_value');
    });

    it('should throw when saving secret while locked', async () => {
      vault.lock();

      await assert.rejects(
        async () => vault.saveSecret('key', 'value'),
        NotAuthenticatedError
      );
    });
  });

  describe('Recovery', () => {
    it('should recover account with valid recovery code', async () => {
      const { did, recoveryCode } = await vault.register('old-password');
      vault.lock();

      const result = await vault.recoverAccount({
        recoveryCode,
        newPassword: 'new-password'
      });

      assert.strictEqual(result.did, did);
      assert.strictEqual(vault.isAuthenticated(), true);
    });

    it('should be able to login with new password after recovery', async () => {
      const { recoveryCode } = await vault.register('old-password');
      vault.lock();

      await vault.recoverAccount({
        recoveryCode,
        newPassword: 'new-password'
      });
      vault.lock();

      // Should login with new password
      await vault.login('new-password');
      assert.strictEqual(vault.isAuthenticated(), true);
    });

    it('should fail recovery with invalid code', async () => {
      await vault.register('password');
      vault.lock();

      await assert.rejects(
        async () => vault.recoverAccount({
          recoveryCode: 'wrong',
          newPassword: 'new-password'
        }),
        AuthenticationError
      );
    });
  });

  describe('Stored Identities', () => {
    it('should list stored identities', async () => {
      const { did } = await vault.register('password');

      const identities = await vault.getStoredIdentities();

      assert.strictEqual(identities.length, 1);
      assert.strictEqual(identities[0], did);
    });

    it('should return empty array when no identities', async () => {
      const identities = await vault.getStoredIdentities();
      assert.deepStrictEqual(identities, []);
    });
  });

  describe('Signing', () => {
    it('should sign data when authenticated', async () => {
      await vault.register('password');
      const data = new Uint8Array([1, 2, 3, 4, 5]);

      const signature = await vault.sign(data);

      assert.ok(signature instanceof Uint8Array);
      assert.ok(signature.length > 0);
    });

    it('should throw when signing while locked', async () => {
      await vault.register('password');
      vault.lock();

      await assert.rejects(
        async () => vault.sign(new Uint8Array([1, 2, 3])),
        NotAuthenticatedError
      );
    });
  });

  describe('Disposal', () => {
    it('should dispose and prevent further use', async () => {
      await vault.register('password');
      vault.dispose();

      assert.strictEqual(vault.isAuthenticated(), false);
    });

    it('should throw after disposal', async () => {
      await vault.register('password');
      vault.dispose();

      await assert.rejects(
        async () => vault.login('password'),
        /disposed/i
      );
    });
  });
});
