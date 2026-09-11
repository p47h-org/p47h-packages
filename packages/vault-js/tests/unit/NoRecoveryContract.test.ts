/**
 * @fileoverview The "no recovery" contract.
 *
 * `@p47h/vault-js` deliberately ships **without** an account recovery mechanism.
 * The identity is wrapped with material derived from the active password, so a
 * recovery code cannot provide an independent route to it. An earlier version
 * shipped one anyway: it rewrote the vault under the new password while leaving
 * the identity bound to the old one, producing a vault that opened with neither
 * password. That is silent, permanent data loss — see RECOVERY.md.
 *
 * These tests pin the contract so the mechanism cannot come back by accident,
 * and so that if it comes back **on purpose** it must arrive with a key
 * hierarchy that actually supports it (two-tier DEK/KEK) plus a round-trip test
 * proving `register(P1) -> recover(code, P2) -> login(P2)` works.
 *
 * If you are here because a test failed: do not delete the assertion. Either
 * you reintroduced recovery without the key hierarchy (don't), or you
 * implemented it properly — in which case replace this file with the
 * round-trip test.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { RegisterIdentityUseCase } from '../../src/application/use-cases/RegisterIdentityUseCase';
import { LoginUseCase } from '../../src/application/use-cases/LoginUseCase';
import { SessionManager } from '../../src/application/services/SessionManager';
import { MockStorage } from '../mocks/MockStorage';
import { MockCryptoPort } from '../mocks/MockCryptoPort';
import * as publicApi from '../../src/index';

const P1 = 'original-password';

describe('No-recovery contract', () => {
  let crypto: MockCryptoPort;
  let storage: MockStorage;
  let session: SessionManager;
  let register: RegisterIdentityUseCase;
  let login: LoginUseCase;

  beforeEach(() => {
    crypto = new MockCryptoPort();
    storage = new MockStorage();
    session = new SessionManager();
    register = new RegisterIdentityUseCase(crypto, storage, session);
    login = new LoginUseCase(crypto, storage, session);
  });

  it('registration does not hand the caller a recovery code', async () => {
    const result = await register.execute({ password: P1 });

    assert.ok(result.did, 'registration must still return a DID');
    assert.strictEqual(
      (result as Record<string, unknown>)['recoveryCode'],
      undefined,
      'registration must not return a recovery code — it would be a false safety net'
    );
  });

  it('registration does not persist a second copy of the vault', async () => {
    const { did } = await register.execute({ password: P1 });

    const stored = await storage.get(did);
    assert.ok(stored);
    assert.strictEqual(
      (stored as Record<string, unknown>)['recoveryBlob'],
      undefined,
      'a recovery blob is a second offline-attack oracle for the same data'
    );
  });

  it('the public API exposes no recovery surface', () => {
    const exported = Object.keys(publicApi);
    const offenders = exported.filter((name) => /recover/i.test(name));
    assert.deepStrictEqual(
      offenders,
      [],
      `public API must not export recovery symbols, found: ${offenders.join(', ')}`
    );
  });

  it('the vault still works normally without recovery', async () => {
    const { did } = await register.execute({ password: P1 });
    session.clear();

    const info = await login.execute({ password: P1 });
    assert.strictEqual(info.did, did, 'the password must still open the vault');
  });

  it('a wrong password is rejected', async () => {
    await register.execute({ password: P1 });
    session.clear();

    await assert.rejects(
      () => login.execute({ password: 'not-the-password' }),
      'a wrong password must not open the vault — if this passes, the mock is blind'
    );
  });
});
