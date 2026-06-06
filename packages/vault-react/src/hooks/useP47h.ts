/**
 * @fileoverview useP47h - Context Access Hook
 * 
 * Primary hook for accessing the P47H Vault context.
 * 
 * @module hooks/useP47h
 * @license Apache-2.0
 */

import { useContext } from 'react';
import { P47hContext } from '../context/P47hContext';
import type { P47hContextValue } from '../types';

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Access the P47H Vault context.
 * 
 * This is the low-level hook for direct context access.
 * For most use cases, prefer `useIdentity` or `useSecret`.
 * 
 * @returns The full P47H context value
 * @throws {Error} If used outside of P47hProvider
 * 
 * @example
 * ```tsx
 * function VaultStatus() {
 *   const { state, did, isAuthenticated } = useP47h();
 *   
 *   return (
 *     <div>
 *       <p>State: {state}</p>
 *       <p>DID: {did ?? 'Not authenticated'}</p>
 *       <p>Authenticated: {isAuthenticated ? 'Yes' : 'No'}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useP47h(): P47hContextValue {
  const context = useContext(P47hContext);

  // The default context (used outside a provider) has methods that throw a helpful
  // "No P47hProvider" error, so callers get a clear failure rather than a silent no-op.
  return context;
}
