/**
 * @fileoverview Hook Return Types
 *
 * Type definitions for hook return values.
 *
 * @module types/hooks
 * @license Apache-2.0
 */

// ============================================================================
// useIdentity Return Type
// ============================================================================

/**
 * Return type for the useIdentity hook.
 */
export interface UseIdentityReturn {
  /**
   * Current DID if authenticated.
   */
  did: string | null;

  /**
   * Whether an identity is currently authenticated.
   */
  isAuthenticated: boolean;

  /**
   * Whether an auth operation is in progress.
   */
  isLoading: boolean;

  /**
   * Last error that occurred, if any.
   */
  error: Error | null;

  /**
   * Register a new identity.
   * There is no recovery code: the password is the only key to the vault.
   * See RECOVERY.md in @p47h/vault-js.
   */
  register: (password: string) => Promise<{ did: string }>;

  /**
   * Login with an existing identity.
   */
  login: (password: string, did?: string) => Promise<void>;

  /**
   * Lock the vault and clear sensitive data.
   */
  logout: () => void;


  /**
   * List of stored identity DIDs.
   */
  storedIdentities: string[];
}

// ============================================================================
// useSecret Return Type
// ============================================================================

/**
 * Status states for the useSecret hook.
 */
export type SecretStatus = 'idle' | 'loading' | 'saving' | 'error';

/**
 * Return type for the useSecret hook.
 * Provides a semantic object for easy UI binding.
 */
export interface UseSecretReturn {
  /**
   * The decrypted secret value, or null if not found.
   */
  value: string | null;

  /**
   * Function to save/update the secret (auto-encrypts).
   */
  set: (value: string) => void;

  /**
   * Current operation status.
   */
  status: SecretStatus;

  /**
   * Whether the secret exists (value !== null).
   * Useful for showing placeholders vs actual content.
   */
  exists: boolean;

  /**
   * Whether the vault is locked (no identity loaded).
   * Useful for showing lock icons in UI.
   */
  locked: boolean;

  /**
   * Last error that occurred, if any.
   */
  error: Error | null;
}
