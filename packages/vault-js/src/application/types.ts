/**
 * @fileoverview Internal Vault Data Types
 * 
 * Shared types for internal vault operations across use cases.
 * 
 * @module application/types
 * @license Apache-2.0
 */

/**
 * Internal structure of the encrypted vault JSON payload.
 */
export interface VaultInternalData {
  readonly did: string;
  readonly wrappedSecret: string;  // Base64 encoded
  readonly salt: string;           // Base64 encoded
  secrets: Record<string, string>; // User secrets map
  createdAt: number;
}

/** Recovery code format: RK-XXXX-XXXX-XXXX-XXXX (16 bytes = 32 hex chars) */
export const RECOVERY_CODE_PREFIX = 'RK';
export const RECOVERY_CODE_BYTES = 16;
