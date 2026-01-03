/**
 * @fileoverview useSecret - Encrypted State Hook
 * 
 * [PARCHE 2 & 3] The core hook for working with encrypted secrets.
 * 
 * This hook implements:
 * - Race condition protection using request IDs (PARCHE 2)
 * - Semantic return object for easy UI binding (PARCHE 3)
 * - Automatic sync when identity or key changes
 * - Debounced saves to prevent excessive writes
 * 
 * Think of it as `useState()` but encrypted and persisted.
 * 
 * @module hooks/useSecret
 * @license Apache-2.0
 */

import { 
  useState, 
  useEffect, 
  useCallback, 
  useRef 
} from 'react';
import { useP47h } from './useP47h';
import type { UseSecretReturn, SecretStatus } from '../types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Debounce delay for save operations (ms).
 * Prevents excessive writes during rapid typing.
 */
const SAVE_DEBOUNCE_MS = 300;

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for working with encrypted secrets.
 * 
 * [PARCHE 2] Implements race condition protection:
 * - Uses a request ID pattern with useRef
 * - Ignores stale responses from previous key/identity
 * 
 * [PARCHE 3] Returns a semantic object:
 * - `value`: The decrypted secret
 * - `set`: Function to update the secret
 * - `status`: Current operation status
 * - `exists`: Whether the secret exists
 * - `locked`: Whether the vault is locked
 * - `error`: Last error, if any
 * 
 * @param key - Unique identifier for the secret
 * @returns Secret state and setter
 * 
 * @example Basic usage
 * ```tsx
 * function SecretNote() {
 *   const { value, set, status, locked } = useSecret('my_note');
 *   
 *   if (locked) {
 *     return <div>🔒 Vault locked - login to view</div>;
 *   }
 *   
 *   if (status === 'loading') {
 *     return <div>Decrypting...</div>;
 *   }
 *   
 *   return (
 *     <textarea
 *       value={value ?? ''}
 *       onChange={(e) => set(e.target.value)}
 *       placeholder="Write something secret..."
 *     />
 *   );
 * }
 * ```
 * 
 * @example With status indicators
 * ```tsx
 * function APIKeyInput() {
 *   const { value, set, status, exists, error } = useSecret('api_key');
 *   
 *   return (
 *     <div>
 *       <input
 *         type="password"
 *         value={value ?? ''}
 *         onChange={(e) => set(e.target.value)}
 *         placeholder={exists ? '••••••••' : 'Enter API key'}
 *       />
 *       {status === 'saving' && <span>💾 Saving...</span>}
 *       {status === 'error' && <span>❌ {error?.message}</span>}
 *       {status === 'idle' && exists && <span>✅ Saved</span>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSecret(key: string): UseSecretReturn {
  const context = useP47h();
  
  // ============================================================================
  // Local State
  // ============================================================================
  
  const [value, setValue] = useState<string | null>(null);
  const [status, setStatus] = useState<SecretStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  
  // ============================================================================
  // Race Condition Protection (PARCHE 2)
  // ============================================================================
  
  /**
   * Request ID counter for race condition protection.
   * Each fetch increments this, and we only apply results if the ID matches.
   */
  const requestIdRef = useRef(0);
  
  /**
   * Track if component is mounted to prevent state updates after unmount.
   */
  const isMountedRef = useRef(true);
  
  /**
   * Debounce timer for save operations.
   */
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  /**
   * Pending value to save (for debouncing).
   */
  const pendingValueRef = useRef<string | null>(null);

  // ============================================================================
  // Derived State
  // ============================================================================
  
  /**
   * Whether the vault is currently locked (no identity loaded).
   */
  const locked = !context.isAuthenticated;
  
  /**
   * Whether the secret exists (has a non-null value).
   */
  const exists = value !== null;

  // ============================================================================
  // Fetch Effect
  // ============================================================================
  
  useEffect(() => {
    isMountedRef.current = true;
    
    // Reset state when key changes
    setValue(null);
    setError(null);
    
    // Don't fetch if locked or no key
    if (locked || !key) {
      setStatus('idle');
      return;
    }
    
    // Generate unique request ID for this fetch
    const currentRequestId = ++requestIdRef.current;
    
    // Start loading
    setStatus('loading');
    
    // Fetch the secret
    context.getSecret(key)
      .then((secretValue) => {
        // [PARCHE 2] Race condition check:
        // Only apply if this is still the current request and component is mounted
        if (
          requestIdRef.current !== currentRequestId || 
          !isMountedRef.current
        ) {
          return;
        }
        
        setValue(secretValue);
        setStatus('idle');
        setError(null);
      })
      .catch((err) => {
        // [PARCHE 2] Race condition check
        if (
          requestIdRef.current !== currentRequestId || 
          !isMountedRef.current
        ) {
          return;
        }
        
        const fetchError = err instanceof Error ? err : new Error(String(err));
        setError(fetchError);
        setStatus('error');
      });
    
    // Cleanup
    return () => {
      isMountedRef.current = false;
      
      // Cancel any pending save
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [key, context.isAuthenticated, context.did]); // Re-fetch when key or auth changes

  // ============================================================================
  // Save Function
  // ============================================================================
  
  /**
   * Perform the actual save operation.
   */
  const performSave = useCallback(async (valueToSave: string) => {
    // Clear pending
    pendingValueRef.current = null;
    
    if (!isMountedRef.current) return;
    
    setStatus('saving');
    
    try {
      await context.saveSecret(key, valueToSave);
      
      if (!isMountedRef.current) return;
      
      setStatus('idle');
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      
      const saveError = err instanceof Error ? err : new Error(String(err));
      setError(saveError);
      setStatus('error');
    }
  }, [key, context]);
  
  /**
   * Debounced setter function.
   * Updates local state immediately, debounces the save.
   */
  const set = useCallback((newValue: string) => {
    // Optimistic update
    setValue(newValue);
    setError(null);
    
    // Can't save if locked
    if (locked) {
      setError(new Error('Cannot save: vault is locked'));
      setStatus('error');
      return;
    }
    
    // Store pending value
    pendingValueRef.current = newValue;
    
    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    
    // Show saving indicator (briefly)
    setStatus('saving');
    
    // Debounce the actual save
    saveTimerRef.current = setTimeout(() => {
      const valueToSave = pendingValueRef.current;
      if (valueToSave !== null) {
        performSave(valueToSave);
      }
    }, SAVE_DEBOUNCE_MS);
  }, [locked, performSave]);

  // ============================================================================
  // Return (PARCHE 3: Semantic Object)
  // ============================================================================
  
  return {
    value,
    set,
    status,
    exists,
    locked,
    error,
  };
}
