/**
 * @fileoverview Event Types
 *
 * Event definitions for VaultController state synchronization.
 *
 * @module types/events
 * @license Apache-2.0
 * @internal
 */

import type { VaultState } from './state';

// ============================================================================
// Event Types
// ============================================================================

/**
 * Events emitted by the VaultController for state synchronization.
 * @internal
 */
export type VaultEventType = 'state-change' | 'auth-change' | 'error';

/**
 * Event payload for VaultController events.
 * @internal
 */
export interface VaultEvent {
  type: VaultEventType;
  state: VaultState;
  did: string | null;
  error: Error | null;
}

/**
 * Listener function type for VaultController events.
 * @internal
 */
export type VaultEventListener = (event: VaultEvent) => void;
