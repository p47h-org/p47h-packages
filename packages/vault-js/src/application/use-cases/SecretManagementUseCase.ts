/**
 * @fileoverview Secret Management Use Case
 * 
 * Handles saving and retrieving encrypted secrets.
 * 
 * @module application/use-cases/SecretManagementUseCase
 * @license Apache-2.0
 */

import type { IStorage } from '../../domain/IStorage';
import type { ICryptoPort } from '../ports/ICryptoPort';
import type { SessionManager } from '../services/SessionManager';
import type { VaultInternalData } from '../types';
import { NotAuthenticatedError, VaultError } from '../../domain/errors';
import { toBase64, fromBase64 } from '../../utils/encoding';

/**
 * Use case for managing encrypted secrets.
 * 
 * Responsibilities:
 * - Save secrets (encrypt and persist)
 * - Retrieve secrets (from session cache)
 * - Delete secrets
 * - List secret keys
 */
export class SecretManagementUseCase {
  constructor(
    private readonly crypto: ICryptoPort,
    private readonly storage: IStorage,
    private readonly session: SessionManager
  ) {}

  /**
   * Saves an encrypted secret to the vault.
   * 
   * @param key - Unique identifier for the secret
   * @param value - The secret value to store
   * @throws {NotAuthenticatedError} If vault is locked
   * @throws {VaultError} If storage operation fails
   */
  async saveSecret(key: string, value: string): Promise<void> {
    if (!this.session.isAuthenticated()) {
      throw new NotAuthenticatedError();
    }

    const did = this.session.getDid();
    const password = this.session.getPassword();

    // Update in-memory cache
    this.session.setSecret(key, value);

    // Retrieve and update persisted blob
    const stored = await this.storage.get(did);
    if (!stored) {
      throw new VaultError('Storage corruption during save', 'STORAGE_ERROR');
    }
    
    // Decrypt, update, re-encrypt
    const decrypted = this.crypto.decryptVault(
      fromBase64(stored.wrappedData), 
      password
    );
    const originalData = JSON.parse(new TextDecoder().decode(decrypted)) as VaultInternalData;
    
    originalData.secrets = { ...this.session.getAllSecrets() };
    originalData.createdAt = Date.now();
    
    const updatedBytes = new TextEncoder().encode(JSON.stringify(originalData));
    
    // Re-encrypt main copy
    const newEncryptedMain = this.crypto.encryptVault(updatedBytes, password);
    stored.wrappedData = toBase64(newEncryptedMain);
    
    // NOTE: Recovery blob is NOT updated - it's a snapshot at registration time.
    // This is a design decision: recovery is for IDENTITY, not for secrets.
    // Secrets can be re-added after recovery.
    
    stored.updatedAt = Date.now();
    await this.storage.save(did, stored);
  }

  /**
   * Retrieves a decrypted secret from the session cache.
   * 
   * @param key - The secret identifier
   * @returns The secret value, or null if not found
   * @throws {NotAuthenticatedError} If vault is locked
   */
  getSecret(key: string): string | null {
    if (!this.session.isAuthenticated()) {
      throw new NotAuthenticatedError();
    }
    return this.session.getSecret(key);
  }

  /**
   * Deletes a secret from the vault.
   * 
   * @param key - The secret identifier to delete
   * @throws {NotAuthenticatedError} If vault is locked
   * @throws {VaultError} If storage operation fails
   */
  async deleteSecret(key: string): Promise<void> {
    if (!this.session.isAuthenticated()) {
      throw new NotAuthenticatedError();
    }

    const did = this.session.getDid();
    const password = this.session.getPassword();
    
    // Remove from session cache first
    this.session.deleteSecret(key);
    
    // Re-persist without this secret
    const stored = await this.storage.get(did);
    if (!stored) {
      throw new VaultError('Storage corruption during delete', 'STORAGE_ERROR');
    }

    const decrypted = this.crypto.decryptVault(
      fromBase64(stored.wrappedData),
      password
    );
    const originalData = JSON.parse(new TextDecoder().decode(decrypted)) as VaultInternalData;
    
    delete originalData.secrets[key];
    originalData.createdAt = Date.now();

    const updatedBytes = new TextEncoder().encode(JSON.stringify(originalData));
    const newEncryptedMain = this.crypto.encryptVault(updatedBytes, password);
    stored.wrappedData = toBase64(newEncryptedMain);
    stored.updatedAt = Date.now();

    await this.storage.save(did, stored);
  }

  /**
   * Lists all secret keys in the vault.
   * 
   * @returns Array of secret key identifiers
   * @throws {NotAuthenticatedError} If vault is locked
   */
  listSecretKeys(): string[] {
    if (!this.session.isAuthenticated()) {
      throw new NotAuthenticatedError();
    }
    return Object.keys(this.session.getAllSecrets());
  }
}
