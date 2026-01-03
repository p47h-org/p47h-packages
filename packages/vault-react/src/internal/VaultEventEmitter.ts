/**
 * @fileoverview VaultEventEmitter - Type-safe Event System
 *
 * Generic event emitter extracted from VaultController for reusability
 * and single responsibility principle compliance.
 *
 * @module internal/VaultEventEmitter
 * @license Apache-2.0
 * @internal
 */

import type { VaultEvent, VaultEventListener, VaultState } from '../types';

// ============================================================================
// VaultEventEmitter Class
// ============================================================================

/**
 * Type-safe event emitter for vault state changes.
 *
 * Features:
 * - Typed events with VaultEvent payload
 * - Immediate state emission to new subscribers
 * - Safe removal of listeners
 * - Current state snapshot for event creation
 *
 * @internal
 */
export class VaultEventEmitter {
  private _listeners: Set<VaultEventListener> = new Set();

  // Current state for event creation
  private _state: VaultState = 'init';
  private _did: string | null = null;
  private _error: Error | null = null;

  // ============================================================================
  // State Management
  // ============================================================================

  /**
   * Update internal state snapshot.
   */
  updateState(state: VaultState, did: string | null, error: Error | null): void {
    this._state = state;
    this._did = did;
    this._error = error;
  }

  /**
   * Get current state.
   */
  get state(): VaultState {
    return this._state;
  }

  /**
   * Get current DID.
   */
  get did(): string | null {
    return this._did;
  }

  /**
   * Get current error.
   */
  get error(): Error | null {
    return this._error;
  }

  // ============================================================================
  // Event Subscription
  // ============================================================================

  /**
   * Subscribe to vault state changes.
   *
   * @param listener - Callback function for state updates
   * @returns Unsubscribe function
   */
  subscribe(listener: VaultEventListener): () => void {
    this._listeners.add(listener);

    // Immediately emit current state to new subscriber
    listener(this.createEvent('state-change'));

    return () => {
      this._listeners.delete(listener);
    };
  }

  /**
   * Get the number of active listeners.
   */
  get listenerCount(): number {
    return this._listeners.size;
  }

  /**
   * Clear all listeners.
   */
  clear(): void {
    this._listeners.clear();
  }

  // ============================================================================
  // Event Emission
  // ============================================================================

  /**
   * Emit an event to all subscribers.
   */
  emit(type: VaultEvent['type']): void {
    const event = this.createEvent(type);
    this._listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[VaultEventEmitter] Listener error:', err);
      }
    });
  }

  /**
   * Create an event object with current state.
   */
  createEvent(type: VaultEvent['type']): VaultEvent {
    return {
      type,
      state: this._state,
      did: this._did,
      error: this._error,
    };
  }
}
