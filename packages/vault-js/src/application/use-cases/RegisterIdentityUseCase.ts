/**
 * @fileoverview Register Identity Use Case
 * 
 * Creates a new cryptographic identity (DID) and persists it encrypted.
 * 
 * @module application/use-cases/RegisterIdentityUseCase
 * @license Apache-2.0
 */

import type { IStorage } from '../../domain/IStorage';
import type { RegistrationResult, EncryptedVaultBlob } from '../../domain/types';
import type { ICryptoPort } from '../ports/ICryptoPort';
import type { SessionManager } from '../services/SessionManager';
import type { VaultInternalData } from '../types';
import { RECOVERY_CODE_PREFIX, RECOVERY_CODE_BYTES } from '../types';
import { toBase64 } from '../../utils/encoding';

/**
 * Input parameters for register use case.
 */
export interface RegisterInput {
  password: string;
}

/**
 * Use case for registering a new cryptographic identity.
 * 
 * Responsibilities:
 * - Generate Ed25519 keypair via WASM
 * - Derive session key using Argon2id
 * - Generate recovery code
 * - Encrypt vault with both password and recovery code
 * - Persist to storage
 * - Establish authenticated session
 */
export class RegisterIdentityUseCase {
  constructor(
    private readonly crypto: ICryptoPort,
    private readonly storage: IStorage,
    private readonly session: SessionManager
  ) {}

  /**
   * Executes the registration flow.
   * 
   * @param input - Registration parameters
   * @returns The generated DID and recovery code
   */
  async execute(input: RegisterInput): Promise<RegistrationResult> {
    const { password } = input;

    // 1. Generate identity and derive encryption keys
    const client = this.crypto.createIdentity();
    const did = client.get_did();

    const salt = this.crypto.getRandomValues(16);
    const sessionKey = this.crypto.deriveSessionKey(password, salt);

    // 2. Export wrapped (encrypted) private key
    const wrappedSecret = client.export_wrapped_secret(sessionKey);

    // 3. Prepare internal vault data structure
    const internalData: VaultInternalData = {
      did,
      wrappedSecret: toBase64(wrappedSecret),
      salt: toBase64(salt),
      secrets: {},
      createdAt: Date.now(),
    };

    const internalJson = JSON.stringify(internalData);
    const internalBytes = new TextEncoder().encode(internalJson);

    // 4. Create encrypted copies for password and recovery access
    const encryptedMain = this.crypto.encryptVault(internalBytes, password);
    const recoveryCode = this.generateRecoveryCode();
    const encryptedRecovery = this.crypto.encryptVault(internalBytes, recoveryCode);

    // 5. Persist to storage
    const storageBlob: EncryptedVaultBlob = {
      version: 1,
      did,
      salt: toBase64(salt),
      wrappedData: toBase64(encryptedMain),
      recoveryBlob: toBase64(encryptedRecovery),
      updatedAt: Date.now()
    };

    await this.storage.save(did, storageBlob);

    // 6. Establish authenticated session
    this.session.establish(client, sessionKey, did, password, {});

    return { did, recoveryCode };
  }

  /**
   * Generates a high-entropy recovery code.
   * Format: RK-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX (32 hex chars)
   */
  private generateRecoveryCode(): string {
    const bytes = this.crypto.getRandomValues(RECOVERY_CODE_BYTES);
    const hex = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join('');
    
    // Format: RK-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX
    return `${RECOVERY_CODE_PREFIX}-${hex.slice(0, 8)}-${hex.slice(8, 16)}-${hex.slice(16, 24)}-${hex.slice(24, 32)}`;
  }
}
