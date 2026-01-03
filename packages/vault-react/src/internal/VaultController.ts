/**
 * @fileoverview VaultController - Internal State Orchestrator
 *
 * Refactored controller that delegates responsibilities to:
 * - VaultEventEmitter: Event pub/sub system
 * - InitializationOrchestrator: WASM init with timeout/retry
 *
 * This controller now focuses on:
 * - State machine coordination
 * - VaultService lifecycle management
 * - Identity and secret operations
 *
 * @internal This module should NOT be exported publicly.
 * @module internal/VaultController
 * @license Apache-2.0
 */

import { P47hVault } from '@p47h/vault-js';
import type { VaultState, VaultEventListener, P47hProviderConfig } from '../types';
import { VaultEventEmitter } from './VaultEventEmitter';
import {
  InitializationOrchestrator,
  InitTimeoutError,
  WasmNotSupportedError,
  InitExhaustedError,
} from './InitializationOrchestrator';

// Re-export errors for external use
export { InitTimeoutError, WasmNotSupportedError, InitExhaustedError };

// ============================================================================
// VaultController Class
// ============================================================================

/**
 * Internal controller that manages the VaultService lifecycle.
 *
 * Refactored to delegate:
 * - Event emission → VaultEventEmitter
 * - Init logic → InitializationOrchestrator
 *
 * @internal
 */
export class VaultController {
  // ============================================================================
  // Dependencies (Composition over Inheritance)
  // ============================================================================

  private readonly _eventEmitter = new VaultEventEmitter();
  private readonly _initOrchestrator = new InitializationOrchestrator();

  // ============================================================================
  // Private State
  // ============================================================================

  private _vault: P47hVault | null = null;
  private _state: VaultState = 'init';
  private _did: string | null = null;
  private _error: Error | null = null;
  private _storedIdentities: string[] = [];
  private _initPromise: Promise<void> | null = null;
  private _isDisposed = false;

  // ============================================================================
  // Getters (Read-only access to state)
  // ============================================================================

  get state(): VaultState {
    return this._state;
  }

  get did(): string | null {
    return this._did;
  }

  get error(): Error | null {
    return this._error;
  }

  get isAuthenticated(): boolean {
    return this._state === 'unlocked' && this._did !== null;
  }

  get isLoading(): boolean {
    return this._state === 'init';
  }

  get initElapsedMs(): number {
    return this._initOrchestrator.elapsedMs;
  }

  get initAttempt(): number {
    return this._initOrchestrator.attempt;
  }

  get storedIdentities(): string[] {
    return [...this._storedIdentities];
  }

  /**
   * Direct access to VaultService for advanced operations.
   * @throws {Error} If vault not initialized
   */
  get vault(): P47hVault {
    if (!this._vault) {
      throw new Error('VaultController: Vault not initialized. Call init() first.');
    }
    return this._vault;
  }

  // ============================================================================
  // Event Subscription (Delegated to VaultEventEmitter)
  // ============================================================================

  /**
   * Subscribe to vault state changes.
   */
  subscribe(listener: VaultEventListener): () => void {
    return this._eventEmitter.subscribe(listener);
  }

  // ============================================================================
  // State Transitions
  // ============================================================================

  /**
   * Update internal state and notify subscribers.
   */
  private _setState(
    state: VaultState,
    options?: { did?: string | null; error?: Error | null }
  ): void {
    const prevState = this._state;
    const prevDid = this._did;

    this._state = state;

    if (options?.did !== undefined) {
      this._did = options.did;
    }

    if (options?.error !== undefined) {
      this._error = options.error;
    } else if (state !== 'error') {
      this._error = null;
    }

    // Update emitter state
    this._eventEmitter.updateState(this._state, this._did, this._error);

    // Determine event type based on what changed
    if (prevDid !== this._did) {
      this._eventEmitter.emit('auth-change');
    } else if (prevState !== this._state) {
      this._eventEmitter.emit('state-change');
    }
  }

  // ============================================================================
  // Initialization (Delegated to InitializationOrchestrator)
  // ============================================================================

  /**
   * Initialize the vault with optional configuration.
   */
  async init(config?: P47hProviderConfig): Promise<void> {
    // Already initialized or disposed
    if (this._vault && this._state !== 'init') {
      return;
    }

    // Prevent duplicate initialization
    if (this._initPromise) {
      return this._initPromise;
    }

    this._initPromise = this._performInit(config);

    try {
      await this._initPromise;
    } finally {
      this._initPromise = null;
    }
  }

  /**
   * Perform initialization using the orchestrator.
   */
  private async _performInit(config?: P47hProviderConfig): Promise<void> {
    const currentRequestId = this._initOrchestrator.requestId + 1;

    try {
      await this._initOrchestrator.execute(
        async () => {
          // Create vault instance
          this._vault = new P47hVault();

          // Initialize WASM
          await this._vault.init(config);

          // Check if aborted
          if (!this._initOrchestrator.isCurrentRequest(currentRequestId)) {
            this._vault.dispose();
            this._vault = null;
            return;
          }

          // Check for stored identities
          this._storedIdentities = await this._vault.getStoredIdentities();

          // Determine initial state
          if (this._storedIdentities.length > 0) {
            this._setState('locked');
          } else {
            this._setState('ready');
          }
        },
        config
      );
    } catch (err) {
      // Clean up on error
      if (this._vault) {
        try {
          this._vault.dispose();
        } catch {
          // Ignore disposal errors
        }
        this._vault = null;
      }

      const error = err instanceof Error ? err : new Error(String(err));
      this._setState('error', { error });
      throw error;
    }
  }

  // ============================================================================
  // Identity Management
  // ============================================================================

  /**
   * Register a new identity.
   */
  async register(password: string): Promise<{ did: string; recoveryCode: string }> {
    this._ensureReady();

    try {
      const result = await this.vault.register(password);

      // Update stored identities
      this._storedIdentities = await this.vault.getStoredIdentities();

      // Transition to unlocked
      this._setState('unlocked', { did: result.did });

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this._setState('error', { error });
      throw error;
    }
  }

  /**
   * Login with an existing identity.
   */
  async login(password: string, did?: string): Promise<void> {
    this._ensureReady();

    try {
      const identity = await this.vault.login(password, did);
      this._setState('unlocked', { did: identity.did });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      // Stay in locked state on auth failure
      this._error = error;
      this._eventEmitter.updateState(this._state, this._did, this._error);
      this._eventEmitter.emit('error');
      throw error;
    }
  }

  /**
   * Lock the vault and clear sensitive data.
   */
  logout(): void {
    // Always clear any previous errors on logout
    const hadError = this._error !== null;
    this._error = null;
    
    if (this._vault && this._state === 'unlocked') {
      this._vault.lock();
      this._setState('locked', { did: null });
    } else if (hadError) {
      // Not unlocked but had an error - notify to clear error state
      this._eventEmitter.updateState(this._state, this._did, this._error);
      this._eventEmitter.emit('state-change');
    }
  }

  /**
   * Recover account using recovery code.
   */
  async recover(recoveryCode: string, newPassword: string): Promise<void> {
    this._ensureReady();

    try {
      await this.vault.recoverAccount({
        recoveryCode,
        newPassword,
        rotateRecoveryCode: false,
      });

      // After recovery, user needs to login with new password
      this._setState('locked');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this._error = error;
      this._eventEmitter.updateState(this._state, this._did, this._error);
      this._eventEmitter.emit('error');
      throw error;
    }
  }

  // ============================================================================
  // Secret Management
  // ============================================================================

  /**
   * Get a secret from the vault.
   */
  async getSecret(key: string): Promise<string | null> {
    this._ensureAuthenticated();
    return this.vault.getSecret(key);
  }

  /**
   * Save a secret to the vault.
   */
  async saveSecret(key: string, value: string): Promise<void> {
    this._ensureAuthenticated();
    await this.vault.saveSecret(key, value);
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Abort any pending initialization.
   */
  abort(): void {
    this._initOrchestrator.abort();
  }

  /**
   * Reset abort flag for reinitialization.
   */
  resetAbort(): void {
    this._initOrchestrator.resetAbort();
  }

  /**
   * Dispose of the controller and release resources.
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }

    this._isDisposed = true;
    this._initOrchestrator.abort();
    this._eventEmitter.clear();

    if (this._vault) {
      this._vault.dispose();
      this._vault = null;
    }

    this._setState('init', { did: null, error: null });
  }

  // ============================================================================
  // Guards
  // ============================================================================

  /**
   * Ensure vault is ready for operations.
   */
  private _ensureReady(): void {
    if (!this._vault) {
      throw new Error('Vault not initialized. Wrap your app in <P47hProvider>.');
    }

    if (this._state === 'init') {
      throw new Error('Vault still initializing. Please wait.');
    }

    if (this._state === 'error') {
      throw this._error ?? new Error('Vault in error state.');
    }
  }

  /**
   * Ensure user is authenticated.
   */
  private _ensureAuthenticated(): void {
    this._ensureReady();

    if (this._state !== 'unlocked') {
      throw new Error('Vault is locked. Please login first.');
    }
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let _globalController: VaultController | null = null;

/**
 * Get or create the global VaultController instance.
 * @internal
 */
export function getVaultController(): VaultController {
  if (!_globalController) {
    _globalController = new VaultController();
  }
  return _globalController;
}

/**
 * Reset the global controller (for testing).
 * @internal
 */
export function resetVaultController(): void {
  if (_globalController) {
    _globalController.dispose();
    _globalController = null;
  }
}
