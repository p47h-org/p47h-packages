/**
 * @fileoverview Unit tests for SessionManager
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { SessionManager } from '../../../src/application/services/SessionManager';
import { NotAuthenticatedError } from '../../../src/domain/errors';
import type { ICryptoClient } from '../../../src/application/ports/ICryptoPort';

// Mock crypto client for tests
class MockCryptoClient implements ICryptoClient {
  public freed = false;
  
  constructor(private readonly did: string = 'did:p47h:test') {}

  get_did(): string { return this.did; }
  get_public_key(): Uint8Array { return new Uint8Array([1, 2, 3]); }
  export_wrapped_secret(_key: Uint8Array): Uint8Array { return new Uint8Array([4, 5, 6]); }
  sign_data(data: Uint8Array): Uint8Array { return data; }
  free(): void { this.freed = true; }
}

describe('SessionManager', () => {
  let session: SessionManager;

  beforeEach(() => {
    session = new SessionManager();
  });

  describe('establish', () => {
    it('should establish a new session', () => {
      const client = new MockCryptoClient();
      const sessionKey = new Uint8Array(32).fill(0x42);

      session.establish(client, sessionKey, 'did:p47h:test', 'password123', { key: 'value' });

      assert.strictEqual(session.isAuthenticated(), true);
      assert.strictEqual(session.getDid(), 'did:p47h:test');
    });

    it('should clear existing session before establishing new one', () => {
      const client1 = new MockCryptoClient('did:1');
      const client2 = new MockCryptoClient('did:2');
      const sessionKey = new Uint8Array(32);

      session.establish(client1, sessionKey, 'did:1', 'pass1', {});
      session.establish(client2, sessionKey, 'did:2', 'pass2', {});

      assert.strictEqual(client1.freed, true, 'Old client should be freed');
      assert.strictEqual(session.getDid(), 'did:2');
    });

    it('should copy secrets to avoid external mutations', () => {
      const client = new MockCryptoClient();
      const secrets = { key: 'value' };

      session.establish(client, new Uint8Array(32), 'did:test', 'pass', secrets);
      
      // Mutate original
      secrets.key = 'mutated';

      assert.strictEqual(session.getSecret('key'), 'value', 'Should not be affected by external mutation');
    });
  });

  describe('clear', () => {
    it('should clear session and free client', () => {
      const client = new MockCryptoClient();
      session.establish(client, new Uint8Array(32), 'did:test', 'pass', {});

      session.clear();

      assert.strictEqual(session.isAuthenticated(), false);
      assert.strictEqual(client.freed, true);
    });

    it('should be idempotent', () => {
      session.clear();
      session.clear(); // Should not throw
      assert.strictEqual(session.isAuthenticated(), false);
    });
  });

  describe('getState', () => {
    it('should return correct state when not authenticated', () => {
      const state = session.getState();

      assert.strictEqual(state.isAuthenticated, false);
      assert.strictEqual(state.currentDid, null);
      assert.strictEqual(state.hasPasswordCache, false);
    });

    it('should return correct state when authenticated', () => {
      const client = new MockCryptoClient();
      session.establish(client, new Uint8Array(32), 'did:test', 'password', {});

      const state = session.getState();

      assert.strictEqual(state.isAuthenticated, true);
      assert.strictEqual(state.currentDid, 'did:test');
      assert.strictEqual(state.hasPasswordCache, true);
    });
  });

  describe('getDid', () => {
    it('should return DID when authenticated', () => {
      const client = new MockCryptoClient('did:p47h:my-identity');
      session.establish(client, new Uint8Array(32), 'did:p47h:my-identity', 'pass', {});

      assert.strictEqual(session.getDid(), 'did:p47h:my-identity');
    });

    it('should throw NotAuthenticatedError when not authenticated', () => {
      assert.throws(
        () => session.getDid(),
        NotAuthenticatedError
      );
    });
  });

  describe('getClient', () => {
    it('should return client when authenticated', () => {
      const client = new MockCryptoClient();
      session.establish(client, new Uint8Array(32), 'did:test', 'pass', {});

      assert.strictEqual(session.getClient(), client);
    });

    it('should throw NotAuthenticatedError when not authenticated', () => {
      assert.throws(
        () => session.getClient(),
        NotAuthenticatedError
      );
    });
  });

  describe('secrets management', () => {
    beforeEach(() => {
      const client = new MockCryptoClient();
      session.establish(client, new Uint8Array(32), 'did:test', 'pass', {
        existing: 'value'
      });
    });

    it('should get existing secret', () => {
      assert.strictEqual(session.getSecret('existing'), 'value');
    });

    it('should return null for non-existent secret', () => {
      assert.strictEqual(session.getSecret('nonexistent'), null);
    });

    it('should set new secret', () => {
      session.setSecret('new_key', 'new_value');
      assert.strictEqual(session.getSecret('new_key'), 'new_value');
    });

    it('should overwrite existing secret', () => {
      session.setSecret('existing', 'updated');
      assert.strictEqual(session.getSecret('existing'), 'updated');
    });

    it('should get all secrets as a copy', () => {
      session.setSecret('key2', 'value2');
      const all = session.getAllSecrets();

      assert.deepStrictEqual(all, { existing: 'value', key2: 'value2' });

      // Verify it's a copy
      all.existing = 'mutated';
      assert.strictEqual(session.getSecret('existing'), 'value');
    });

    it('should throw NotAuthenticatedError for secrets when not authenticated', () => {
      session.clear();

      assert.throws(() => session.getSecret('any'), NotAuthenticatedError);
      assert.throws(() => session.setSecret('any', 'value'), NotAuthenticatedError);
      assert.throws(() => session.getAllSecrets(), NotAuthenticatedError);
    });
  });

  describe('getPassword', () => {
    it('should return cached password', () => {
      const client = new MockCryptoClient();
      session.establish(client, new Uint8Array(32), 'did:test', 'my-password', {});

      assert.strictEqual(session.getPassword(), 'my-password');
    });

    it('should throw NotAuthenticatedError when not authenticated', () => {
      assert.throws(
        () => session.getPassword(),
        NotAuthenticatedError
      );
    });
  });

  describe('getSessionKey', () => {
    it('should return session key', () => {
      const client = new MockCryptoClient();
      const sessionKey = new Uint8Array([1, 2, 3, 4]);
      session.establish(client, sessionKey, 'did:test', 'pass', {});

      const key = session.getSessionKey();
      assert.deepStrictEqual(key, sessionKey);
    });

    it('should throw NotAuthenticatedError when not authenticated', () => {
      assert.throws(
        () => session.getSessionKey(),
        NotAuthenticatedError
      );
    });
  });
});
