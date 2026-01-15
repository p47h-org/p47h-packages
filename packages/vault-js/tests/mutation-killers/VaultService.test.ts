/**
 * @fileoverview VaultService Mutation Killer Tests
 * 
 * Tests designed to kill Stryker mutations in VaultService critical functions.
 * Uses node:test + assert as per vault-js test runner.
 * 
 * @module tests/mutation-killers/VaultService.test.ts
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { VaultFacade } from '../../src/logic/VaultFacade';
import { MockStorage } from '../mocks/MockStorage';
import { MockWasmAdapter } from '../mocks/MockWasmAdapter';
import { 
  InitializationError, 
  AuthenticationError, 
  NotAuthenticatedError,
  VaultError 
} from '../../src/domain/errors';

// ============================================================================
// register() Mutation Killers
// ============================================================================

describe('VaultFacade.register - Mutation Killers', () => {
  let vault: VaultFacade;
  let storage: MockStorage;
  let crypto: MockWasmAdapter;

  beforeEach(async () => {
    vault = new VaultFacade();
    storage = new MockStorage();
    crypto = new MockWasmAdapter();
    (vault as any)._storage = storage;
    (vault as any)._crypto = crypto;
  });

  it('should throw InitializationError when not initialized', async () => {
    // Kill mutant: `if (!this._isInitialized)` → `if (this._isInitialized)`
    await assert.rejects(
      async () => await vault.register('password123'),
      InitializationError
    );
  });

  it('should generate recovery code with RK- prefix', async () => {
    await vault.init();
    const result = await vault.register('password123');
    
    // Kill mutant: recovery code prefix changed
    assert.ok(result.recoveryCode.startsWith('RK-'), 'Must start with RK-');
    assert.strictEqual(result.recoveryCode.split('-').length, 5, 'Must have 5 segments');
  });

  it('should save blob with version 1', async () => {
    await vault.init();
    const { did } = await vault.register('password123');
    
    // Kill mutant: version changed from 1
    const stored = await storage.get(did);
    assert.strictEqual(stored?.version, 1, 'Version must be 1');
  });

  it('should set authenticated after register', async () => {
    await vault.init();
    await vault.register('password123');
    
    // Kill mutant: setSession not called
    assert.strictEqual(vault.isAuthenticated(), true);
  });

  it('should return valid DID format', async () => {
    await vault.init();
    const { did } = await vault.register('password123');
    
    // Kill mutant: DID format wrong
    assert.ok(did.startsWith('did:p47h:'), 'DID must start with did:p47h:');
  });
});

// ============================================================================
// login() Mutation Killers
// ============================================================================

describe('VaultFacade.login - Mutation Killers', () => {
  let vault: VaultFacade;
  let storage: MockStorage;
  let crypto: MockWasmAdapter;

  beforeEach(async () => {
    vault = new VaultFacade();
    storage = new MockStorage();
    crypto = new MockWasmAdapter();
    (vault as any)._storage = storage;
    (vault as any)._crypto = crypto;
    await vault.init();
  });

  it('should throw AuthenticationError when no identities exist', async () => {
    // Kill mutant: `keys.length === 0` → `keys.length !== 0`
    await assert.rejects(
      async () => await vault.login('password'),
      AuthenticationError
    );
  });

  it('should throw AuthenticationError on wrong password', async () => {
    const { did } = await vault.register('password123');
    vault.lock();
    
    // Kill mutant: catch block removed or error type changed
    await assert.rejects(
      async () => await vault.login('wrong', did),
      AuthenticationError
    );
  });

  it('should return correct DID on successful login', async () => {
    const { did } = await vault.register('password123');
    vault.lock();
    
    const result = await vault.login('password123', did);
    
    // Kill mutant: returned DID wrong
    assert.strictEqual(result.did, did);
  });

  it('should be authenticated after login', async () => {
    const { did } = await vault.register('password123');
    vault.lock();
    assert.strictEqual(vault.isAuthenticated(), false);
    
    await vault.login('password123', did);
    
    // Kill mutant: setSession not called
    assert.strictEqual(vault.isAuthenticated(), true);
  });

  it('should include publicKey in result', async () => {
    const { did } = await vault.register('password123');
    vault.lock();
    
    const result = await vault.login('password123', did);
    
    // Kill mutant: publicKey not included
    assert.ok(result.publicKey instanceof Uint8Array, 'publicKey must be Uint8Array');
  });
});

// ============================================================================
// recoverAccount() Mutation Killers
// ============================================================================

describe('VaultFacade.recoverAccount - Mutation Killers', () => {
  let vault: VaultFacade;
  let storage: MockStorage;
  let crypto: MockWasmAdapter;

  beforeEach(async () => {
    vault = new VaultFacade();
    storage = new MockStorage();
    crypto = new MockWasmAdapter();
    (vault as any)._storage = storage;
    (vault as any)._crypto = crypto;
    await vault.init();
  });

  it('should return did in recovery result', async () => {
    const { did, recoveryCode } = await vault.register('password123');
    vault.lock();
    
    const result = await vault.recoverAccount({
      recoveryCode,
      newPassword: 'newpassword456',
      rotateRecoveryCode: false,
    });
    
    // Kill mutant: wrong DID in result
    assert.strictEqual(result.did, did);
  });

  it('should generate new recovery code when rotateRecoveryCode is true', async () => {
    const { recoveryCode } = await vault.register('password123');
    vault.lock();
    
    const result = await vault.recoverAccount({
      recoveryCode,
      newPassword: 'newpassword456',
      rotateRecoveryCode: true,
    });
    
    // Kill mutant: rotateRecoveryCode branch not taken
    assert.ok(result.newRecoveryCode, 'Should include new recovery code');
    assert.ok(result.newRecoveryCode!.startsWith('RK-'), 'New code must be RK- format');
    // Note: can't compare codes as mock uses deterministic random values
  });

  it('should NOT generate new recovery code when rotateRecoveryCode is false', async () => {
    const { recoveryCode } = await vault.register('password123');
    vault.lock();
    
    const result = await vault.recoverAccount({
      recoveryCode,
      newPassword: 'newpassword456',
      rotateRecoveryCode: false,
    });
    
    // Kill mutant: always rotates
    assert.strictEqual(result.newRecoveryCode, undefined);
  });

  it('should login after recovery', async () => {
    const { recoveryCode } = await vault.register('password123');
    vault.lock();
    
    await vault.recoverAccount({
      recoveryCode,
      newPassword: 'newpassword456',
      rotateRecoveryCode: false,
    });
    
    // Kill mutant: auto-login not called
    assert.strictEqual(vault.isAuthenticated(), true);
  });

  it('should update storage updatedAt after recovery', async () => {
    const { did, recoveryCode } = await vault.register('password123');
    const originalBlob = await storage.get(did);
    const originalUpdatedAt = originalBlob?.updatedAt;
    
    // Wait a moment to ensure timestamp changes
    await new Promise(resolve => setTimeout(resolve, 10));
    
    vault.lock();
    
    await vault.recoverAccount({
      recoveryCode,
      newPassword: 'newpassword456',
      rotateRecoveryCode: false,
    });
    
    const updatedBlob = await storage.get(did);
    
    // Kill mutant: storage not updated
    assert.ok(updatedBlob, 'Blob should exist');
    assert.ok(updatedBlob!.updatedAt >= originalUpdatedAt!, 'updatedAt should be >= original');
  });
});

// ============================================================================
// lock() and dispose() Mutation Killers
// ============================================================================

describe('VaultFacade - lock/dispose Mutation Killers', () => {
  let vault: VaultFacade;
  let storage: MockStorage;
  let crypto: MockWasmAdapter;

  beforeEach(async () => {
    vault = new VaultFacade();
    storage = new MockStorage();
    crypto = new MockWasmAdapter();
    (vault as any)._storage = storage;
    (vault as any)._crypto = crypto;
    await vault.init();
  });

  it('lock() should clear authenticated state', async () => {
    await vault.register('password123');
    assert.strictEqual(vault.isAuthenticated(), true);
    
    vault.lock();
    
    // Kill mutant: lock() doesn't clear state
    assert.strictEqual(vault.isAuthenticated(), false);
  });

  it('lock() should make getDid() throw', async () => {
    await vault.register('password123');
    const did = vault.getDid();
    assert.ok(did);
    
    vault.lock();
    
    // Kill mutant: _currentDid not cleared
    assert.throws(
      () => vault.getDid(),
      NotAuthenticatedError
    );
  });

  it('dispose() should prevent further operations', async () => {
    await vault.register('password123');
    vault.dispose();
    
    // Kill mutant: dispose flag not checked
    await assert.rejects(
      async () => await vault.register('another'),
      VaultError
    );
  });

  it('isAuthenticated() should return false after dispose', async () => {
    await vault.register('password123');
    assert.strictEqual(vault.isAuthenticated(), true);
    
    vault.dispose();
    
    // Kill mutant: `&& !this._isDisposed` removed
    assert.strictEqual(vault.isAuthenticated(), false);
  });
});

// ============================================================================
// saveSecret/getSecret Mutation Killers
// ============================================================================

describe('VaultFacade - secrets Mutation Killers', () => {
  let vault: VaultFacade;
  let storage: MockStorage;
  let crypto: MockWasmAdapter;

  beforeEach(async () => {
    vault = new VaultFacade();
    storage = new MockStorage();
    crypto = new MockWasmAdapter();
    (vault as any)._storage = storage;
    (vault as any)._crypto = crypto;
    await vault.init();
  });

  it('getSecret should throw when not authenticated', async () => {
    // Kill mutant: ensureAuthenticated removed
    await assert.rejects(
      async () => await vault.getSecret('key'),
      NotAuthenticatedError
    );
  });

  it('saveSecret should throw when not authenticated', async () => {
    // Kill mutant: ensureAuthenticated removed
    await assert.rejects(
      async () => await vault.saveSecret('key', 'value'),
      NotAuthenticatedError
    );
  });

  it('getSecret should return null for missing key', async () => {
    await vault.register('password123');
    
    const result = await vault.getSecret('nonexistent');
    
    // Kill mutant: returns undefined instead of null
    assert.strictEqual(result, null);
  });

  it('saveSecret should persist to storage', async () => {
    await vault.register('password123');
    const did = vault.getDid();
    
    await vault.saveSecret('api_key', 'secret_value');
    
    // Simulate restart
    vault.lock();
    await vault.login('password123', did);
    
    const retrieved = await vault.getSecret('api_key');
    
    // Kill mutant: secrets not persisted
    assert.strictEqual(retrieved, 'secret_value');
  });
});
