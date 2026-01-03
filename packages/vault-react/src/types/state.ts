/**
 * @fileoverview Vault State Types
 *
 * State machine definitions for the VaultController.
 *
 * @module types/state
 * @license Apache-2.0
 */

// ============================================================================
// Vault State Machine
// ============================================================================

/**
 * Internal state machine for the VaultController.
 *
 * - `init`: WASM is loading, vault not ready
 * - `ready`: WASM loaded, no identity unlocked (show login/register)
 * - `locked`: Identity exists but not unlocked (show login)
 * - `unlocked`: Identity loaded, secrets accessible
 * - `error`: Fatal error occurred during initialization
 */
export type VaultState = 'init' | 'ready' | 'locked' | 'unlocked' | 'error';
