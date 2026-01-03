/**
 * @fileoverview Login Use Case
 * 
 * Unlocks an existing identity with the master password.
 * 
 * @module application/use-cases/LoginUseCase
 * @license Apache-2.0
 */

import type { IStorage } from '../../domain/IStorage';
import type { IdentityInfo } from '../../domain/types';
import type { ICryptoPort } from '../ports/ICryptoPort';
import type { SessionManager } from '../services/SessionManager';
import type { VaultInternalData } from '../types';
import { AuthenticationError, VaultError } from '../../domain/errors';
import { fromBase64 } from '../../utils/encoding';

/**
 * Input parameters for login use case.
 */
export interface LoginInput {
  password: string;
  did?: string;
}

/**
 * Use case for unlocking an existing identity.
 * 
 * Responsibilities:
 * - Retrieve encrypted vault from storage
 * - Decrypt with password
 * - Validate vault integrity
 * - Restore WASM client
 * - Establish authenticated session
 */
export class LoginUseCase {
  constructor(
    private readonly crypto: ICryptoPort,
    private readonly storage: IStorage,
    private readonly session: SessionManager
  ) {}

  /**
   * Executes the login flow.
   * 
   * @param input - Login parameters
   * @returns The identity info
   * @throws {AuthenticationError} If password is wrong or identity not found
   * @throws {VaultError} If vault data is corrupted
   */
  async execute(input: LoginInput): Promise<IdentityInfo> {
    const { password, did } = input;

    // 1. Resolve target DID
    let targetDid: string = did ?? '';
    if (!targetDid) {
      const keys = await this.storage.listKeys();
      if (keys.length === 0) {
        throw new AuthenticationError('No identities found in storage');
      }
      targetDid = keys[0]!;
    }

    // 2. Retrieve encrypted blob
    const storedBlob = await this.storage.get(targetDid);
    if (!storedBlob) {
      throw new AuthenticationError(`Identity ${targetDid} not found`);
    }

    // 3. Decrypt outer blob
    let decryptedBytes: Uint8Array;
    try {
      decryptedBytes = this.crypto.decryptVault(
        fromBase64(storedBlob.wrappedData),
        password
      );
    } catch {
      throw new AuthenticationError('Invalid password or corrupted vault');
    }

    // 4. Parse internal data
    let internalData: VaultInternalData;
    try {
      const json = new TextDecoder().decode(decryptedBytes);
      internalData = JSON.parse(json);
    } catch {
      throw new VaultError('Vault data corruption: Invalid JSON', 'CORRUPT_DATA');
    }

    // 5. Integrity check
    if (internalData.did !== targetDid) {
      throw new VaultError('Integrity error: DID mismatch inside vault', 'INTEGRITY_ERROR');
    }

    // 6. Restore WASM client
    const salt = fromBase64(internalData.salt);
    const sessionKey = this.crypto.deriveSessionKey(password, salt);
    const wrappedSecret = fromBase64(internalData.wrappedSecret);

    const client = this.crypto.restoreIdentity(wrappedSecret, sessionKey);

    // 7. Establish session
    this.session.establish(client, sessionKey, targetDid, password, internalData.secrets);

    return {
      did: targetDid,
      publicKey: client.get_public_key()
    };
  }
}
