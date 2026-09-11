/**
 * @fileoverview Context Value Types
 *
 * Type definitions for the P47H context value.
 *
 * @module types/context
 * @license Apache-2.0
 */

import type { VaultState } from './state';

// ============================================================================
// Context Value Types
// ============================================================================

/**
 * Shape of the P47H context value exposed to consumers.
 */
export interface P47hContextValue {
  /**
   * Current state of the vault.
   */
  state: VaultState;

  /**
   * Current DID if authenticated.
   */
  did: string | null;

  /**
   * Whether an identity is currently authenticated.
   */
  isAuthenticated: boolean;

  /**
   * Whether vault is in a loading state (init or transitioning).
   */
  isLoading: boolean;

  /**
   * Last error that occurred, if any.
   */
  error: Error | null;

  /**
   * Register a new identity with the given password.
   * There is no recovery code: the password is the only key to the vault.
   * See RECOVERY.md in @p47h/vault-js.
   */
  register: (password: string) => Promise<{ did: string }>;

  /**
   * Login with an existing identity.
   */
  login: (password: string, did?: string) => Promise<void>;

  /**
   * Lock the vault and clear sensitive data from memory.
   */
  logout: () => void;


  /**
   * Get a secret from the vault.
   */
  getSecret: (key: string) => Promise<string | null>;

  /**
   * Save a secret to the vault.
   */
  saveSecret: (key: string, value: string) => Promise<void>;

  /**
   * List of stored identity DIDs.
   */
  storedIdentities: string[];
}
