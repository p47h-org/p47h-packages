/**
 * @fileoverview P47H Context Definition
 * 
 * React Context for sharing vault state across the component tree.
 * 
 * @module context/P47hContext
 * @license Apache-2.0
 */

import { createContext } from 'react';
import type { P47hContextValue } from '../types';

// ============================================================================
// Context Definition
// ============================================================================

/**
 * Default context value for when the provider is not present.
 * All methods throw errors to make missing provider obvious.
 */
const defaultContextValue: P47hContextValue = {
  state: 'init',
  did: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  storedIdentities: [],
  
  register: async () => {
    throw new Error('P47hContext: No provider found. Wrap your app in <P47hProvider>.');
  },
  login: async () => {
    throw new Error('P47hContext: No provider found. Wrap your app in <P47hProvider>.');
  },
  logout: () => {
    throw new Error('P47hContext: No provider found. Wrap your app in <P47hProvider>.');
  },
  recover: async () => {
    throw new Error('P47hContext: No provider found. Wrap your app in <P47hProvider>.');
  },
  getSecret: async () => {
    throw new Error('P47hContext: No provider found. Wrap your app in <P47hProvider>.');
  },
  saveSecret: async () => {
    throw new Error('P47hContext: No provider found. Wrap your app in <P47hProvider>.');
  },
};

/**
 * React Context for P47H Vault state and operations.
 * 
 * @example
 * ```tsx
 * // Access context directly (prefer useP47h hook instead)
 * const context = useContext(P47hContext);
 * ```
 */
export const P47hContext = createContext<P47hContextValue>(defaultContextValue);

// Set display name for React DevTools
P47hContext.displayName = 'P47hContext';
