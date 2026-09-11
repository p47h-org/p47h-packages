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

