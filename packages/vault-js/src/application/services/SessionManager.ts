/**
 * @fileoverview Session Manager Service
 * 
 * Manages the authenticated session state including:
 * - WASM client instance
 * - Session key
 * - Cached secrets
 * - Password cache (for re-encryption operations)
 * 
 * @module application/services/SessionManager
 * @license Apache-2.0
 */

import type { ICryptoClient } from '../ports/ICryptoPort';
import { NotAuthenticatedError } from '../../domain/errors';

/**
 * Session state snapshot for inspection.
 */
export interface SessionState {
  readonly isAuthenticated: boolean;
  readonly currentDid: string | null;
  readonly hasPasswordCache: boolean;
}

/**
 * Internal session data structure.
 */
interface SessionData {
  client: ICryptoClient;
  sessionKey: Uint8Array;
  did: string;
  password: string;
  secrets: Record<string, string>;
}

/**
 * Manages vault session lifecycle.
 * 
 * Encapsulates all session-related state and provides methods
 * for establishing, querying, and clearing sessions.
 */
export class SessionManager {
  private _session: SessionData | null = null;

  /**
   * Establishes a new authenticated session.
   * 
   * @param client - WASM crypto client instance
   * @param sessionKey - Derived session key
   * @param did - Decentralized Identifier
   * @param password - Master password (cached for re-encryption)
   * @param secrets - Decrypted secrets map
   */
  establish(
    client: ICryptoClient,
    sessionKey: Uint8Array,
    did: string,
    password: string,
    secrets: Record<string, string>
  ): void {
    // Clear any existing session first
    this.clear();
    
    this._session = {
      client,
      sessionKey,
      did,
      password,
      secrets: { ...secrets }
    };
  }

  /**
   * Clears the current session and frees WASM memory.
   */
  clear(): void {
    if (this._session) {
      try {
        this._session.client.free();
      } catch {
        // Ignore free errors (already freed)
      }
      this._session = null;
    }
  }

  /**
   * Checks if there's an active authenticated session.
   */
  isAuthenticated(): boolean {
    return this._session !== null;
  }

  /**
   * Gets the current session state.
   */
  getState(): SessionState {
    return {
      isAuthenticated: this._session !== null,
      currentDid: this._session?.did ?? null,
      hasPasswordCache: this._session?.password !== undefined
    };
  }

  /**
   * Gets the current DID.
   * 
   * @throws {NotAuthenticatedError} If no active session
   */
  getDid(): string {
    this.ensureAuthenticated();
    return this._session!.did;
  }

  /**
   * Gets the WASM client instance.
   * 
   * @throws {NotAuthenticatedError} If no active session
   */
  getClient(): ICryptoClient {
    this.ensureAuthenticated();
    return this._session!.client;
  }

  /**
   * Gets the session key.
   * 
   * @throws {NotAuthenticatedError} If no active session
   */
  getSessionKey(): Uint8Array {
    this.ensureAuthenticated();
    return this._session!.sessionKey;
  }

  /**
   * Gets the cached password for re-encryption.
   * 
   * @throws {NotAuthenticatedError} If no active session
   */
  getPassword(): string {
    this.ensureAuthenticated();
    return this._session!.password;
  }

  /**
   * Gets a secret from the cache.
   * 
   * @param key - Secret identifier
   * @returns Secret value or null if not found
   * @throws {NotAuthenticatedError} If no active session
   */
  getSecret(key: string): string | null {
    this.ensureAuthenticated();
    return this._session!.secrets[key] ?? null;
  }

  /**
   * Updates a secret in the cache.
   * 
   * @param key - Secret identifier
   * @param value - Secret value
   * @throws {NotAuthenticatedError} If no active session
   */
  setSecret(key: string, value: string): void {
    this.ensureAuthenticated();
    this._session!.secrets[key] = value;
  }

  /**
   * Deletes a secret from the cache.
   * 
   * @param key - Secret identifier
   * @throws {NotAuthenticatedError} If no active session
   */
  deleteSecret(key: string): void {
    this.ensureAuthenticated();
    delete this._session!.secrets[key];
  }

  /**
   * Gets all cached secrets.
   * 
   * @throws {NotAuthenticatedError} If no active session
   */
  getAllSecrets(): Record<string, string> {
    this.ensureAuthenticated();
    return { ...this._session!.secrets };
  }

  /**
   * Ensures there's an active session.
   * 
   * @throws {NotAuthenticatedError} If no active session
   */
  private ensureAuthenticated(): void {
    if (!this._session) {
      throw new NotAuthenticatedError();
    }
  }
}
