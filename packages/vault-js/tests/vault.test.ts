import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { VaultFacade } from '../src/logic/VaultFacade';
import { MockStorage } from './mocks/MockStorage';
import { MockWasmAdapter } from './mocks/MockWasmAdapter';
import { AuthenticationError, NotAuthenticatedError } from '../src/domain/errors';

describe('VaultService (Business Logic)', () => {
  let vault: VaultFacade;
  let storage: MockStorage;
  let crypto: MockWasmAdapter;

  beforeEach(async () => {
    // PREPARACIÓN (Arrange)
    vault = new VaultFacade();
    storage = new MockStorage();
    crypto = new MockWasmAdapter();

    // Inyección de dependencias (casting a any para acceso en test)
    (vault as any)._storage = storage;
    (vault as any)._crypto = crypto;

    await vault.init();
  });

  it('should register a new identity successfully', async () => {
    // EJECUCIÓN (Act)
    const { did } = await vault.register('password123');

    // VERIFICACIÓN (Assert)
    assert.strictEqual(did, 'did:p47h:mock-identity');
    assert.strictEqual(vault.isAuthenticated(), true);
    assert.strictEqual(vault.getDid(), did);

    // Verificar persistencia
    const stored = await storage.get(did);
    assert.ok(stored, 'Storage should contain the blob');
    assert.strictEqual(stored?.did, did);
    
    // Verificar cifrado (el mock hace XOR 0xFF, así que no debe contener JSON plano)
    assert.strictEqual(stored?.wrappedData.includes('{'), false, 'Data should be encrypted');
  });

  it('should login with correct password', async () => {
    // Setup
    const { did } = await vault.register('password123');
    vault.lock(); // Logout
    assert.strictEqual(vault.isAuthenticated(), false);

    // Act
    const info = await vault.login('password123', did);

    // Assert
    assert.strictEqual(info.did, did);
    assert.strictEqual(vault.isAuthenticated(), true);
  });

  it('should fail login with wrong password', async () => {
    const { did } = await vault.register('password123');
    vault.lock();

    // Act & Assert
    await assert.rejects(
      async () => await vault.login('wrong', did),
      AuthenticationError
    );
  });

  it('should save and retrieve secrets securely', async () => {
    await vault.register('password123');

    // Act
    await vault.saveSecret('api_key', 'super_secret_value');

    // Verificar en memoria
    const secret = await vault.getSecret('api_key');
    assert.strictEqual(secret, 'super_secret_value');

    // Verificar persistencia (simular reinicio)
    const did = vault.getDid();
    vault.lock();
    
    await vault.login('password123', did);
    const restoredSecret = await vault.getSecret('api_key');
    assert.strictEqual(restoredSecret, 'super_secret_value');
  });

  it('should throw error when accessing secrets without auth', async () => {
    await assert.rejects(
      async () => await vault.getSecret('any'),
      NotAuthenticatedError
    );
  });

  it('should clear memory on lock', async () => {
    await vault.register('password123');
    vault.lock();

    assert.strictEqual(vault.isAuthenticated(), false);
    
    // Intentar acceder al DID debe fallar
    assert.throws(
      () => vault.getDid(),
      NotAuthenticatedError
    );
  });
});