/**
 * @fileoverview Recover Account Use Case
 * 
 * Recovers account access using the emergency recovery code.
 * 
 * @module application/use-cases/RecoverAccountUseCase
 * @license Apache-2.0
 */

import type { IStorage } from '../../domain/IStorage';
import type { RecoveryOptions, RecoveryResult } from '../../domain/types';
import type { ICryptoPort } from '../ports/ICryptoPort';
import type { VaultInternalData } from '../types';
import { AuthenticationError, VaultError } from '../../domain/errors';
import { toBase64, fromBase64 } from '../../utils/encoding';
import { RECOVERY_CODE_PREFIX, RECOVERY_CODE_BYTES } from '../types';

/**
 * Use case for recovering account with recovery code.
 * 
 * Responsibilities:
 * - Decrypt vault using recovery code
 * - Re-encrypt with new password
 * - Optionally rotate recovery code
 * - Persist updated vault
 */
export class RecoverAccountUseCase {
  constructor(
    private readonly crypto: ICryptoPort,
    private readonly storage: IStorage
  ) {}

  /**
   * Executes the recovery flow.
   * 
   * @param options - Recovery options
   * @returns Recovery result with optional new recovery code
   * @throws {AuthenticationError} If recovery code is invalid
   * @throws {VaultError} If recovery is not available
   */
  async execute(options: RecoveryOptions): Promise<RecoveryResult> {
    const { recoveryCode, newPassword, did, rotateRecoveryCode = false } = options;

    // 1. Resolve target DID
    let targetDid: string = did ?? '';
    if (!targetDid) {
      const keys = await this.storage.listKeys();
      if (keys.length === 0) {
        throw new AuthenticationError('No vaults found');
      }
      targetDid = keys[0]!;
    }

    // 2. Get stored blob
    const stored = await this.storage.get(targetDid);
    if (!stored) {
      throw new AuthenticationError(`Identity ${targetDid} not found`);
    }
    
    if (!stored.recoveryBlob) {
      throw new VaultError(
        'Recovery not available for this identity. It may have been created with an older SDK version.',
        'RECOVERY_UNAVAILABLE'
      );
    }

    // 3. Decrypt using recovery code
    let decryptedBytes: Uint8Array;
    try {
      decryptedBytes = this.crypto.decryptVault(
        fromBase64(stored.recoveryBlob),
        recoveryCode
      );
    } catch {
      throw new AuthenticationError('Invalid Recovery Code');
    }

    // 4. Parse internal data (validate structure)
    try {
      const json = new TextDecoder().decode(decryptedBytes);
      JSON.parse(json) as VaultInternalData;
    } catch {
      throw new VaultError('Vault data corruption during recovery', 'CORRUPT_DATA');
    }

    // 5. Re-encrypt with new password
    const newEncryptedMain = this.crypto.encryptVault(decryptedBytes, newPassword);

    // 6. Handle recovery code rotation
    let newRecoveryBlob: string;
    let generatedRecoveryCode: string | undefined;

    if (rotateRecoveryCode) {
      generatedRecoveryCode = this.generateRecoveryCode();
      const newEncryptedRecovery = this.crypto.encryptVault(decryptedBytes, generatedRecoveryCode);
      newRecoveryBlob = toBase64(newEncryptedRecovery);
    } else {
      newRecoveryBlob = stored.recoveryBlob;
    }

    // 7. Update storage
    stored.wrappedData = toBase64(newEncryptedMain);
    stored.recoveryBlob = newRecoveryBlob;
    stored.updatedAt = Date.now();

    await this.storage.save(targetDid, stored);

    // 8. Return result - only include newRecoveryCode if it was generated
    if (generatedRecoveryCode !== undefined) {
      return {
        did: targetDid,
        newRecoveryCode: generatedRecoveryCode
      };
    }
    return {
      did: targetDid
    };
  }

  /**
   * Generates a high-entropy recovery code.
   */
  private generateRecoveryCode(): string {
    const bytes = this.crypto.getRandomValues(RECOVERY_CODE_BYTES);
    const hex = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join('');
    
    return `${RECOVERY_CODE_PREFIX}-${hex.slice(0, 8)}-${hex.slice(8, 16)}-${hex.slice(16, 24)}-${hex.slice(24, 32)}`;
  }
}
