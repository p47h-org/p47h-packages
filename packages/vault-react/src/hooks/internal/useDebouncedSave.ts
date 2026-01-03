/**
 * @fileoverview useDebouncedSave - Debounced Save Hook
 *
 * Generic hook for debouncing save operations.
 * Extracted from useSecret for reusability.
 *
 * @module hooks/internal/useDebouncedSave
 * @license Apache-2.0
 * @internal
 */

import { useCallback, useRef, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for the debounced save hook.
 */
export interface UseDebouncedSaveConfig<T> {
  /** Delay in milliseconds before executing save */
  delayMs: number;
  /** The actual save function to execute */
  saveFn: (value: T) => Promise<void>;
  /** Callback when save starts */
  onSaveStart?: () => void;
  /** Callback when save completes successfully */
  onSaveComplete?: () => void;
  /** Callback when save fails */
  onSaveError?: (error: Error) => void;
}

/**
 * Return type for the debounced save hook.
 */
export interface UseDebouncedSaveReturn<T> {
  /** Schedule a debounced save */
  scheduleSave: (value: T) => void;
  /** Cancel any pending save */
  cancelPending: () => void;
  /** Whether a save is currently pending */
  isPending: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for debouncing save operations.
 *
 * Features:
 * - Configurable delay
 * - Cancel pending saves on unmount
 * - Callbacks for save lifecycle
 * - isMounted check for async safety
 *
 * @param config - Configuration options
 * @returns Debounced save controller
 *
 * @example
 * ```tsx
 * const { scheduleSave, cancelPending } = useDebouncedSave({
 *   delayMs: 300,
 *   saveFn: async (value) => await api.save(value),
 *   onSaveStart: () => setStatus('saving'),
 *   onSaveComplete: () => setStatus('idle'),
 *   onSaveError: (err) => setError(err),
 * });
 *
 * // Schedule a save (will be debounced)
 * scheduleSave('new value');
 * ```
 *
 * @internal
 */
export function useDebouncedSave<T>(
  config: UseDebouncedSaveConfig<T>
): UseDebouncedSaveReturn<T> {
  const { delayMs, saveFn, onSaveStart, onSaveComplete, onSaveError } = config;

  // Track mounted state
  const isMountedRef = useRef(true);

  // Timer reference
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pending value reference
  const pendingValueRef = useRef<T | null>(null);

  // Is pending flag (using ref to avoid re-renders)
  const isPendingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  /**
   * Perform the actual save.
   */
  const performSave = useCallback(
    async (valueToSave: T) => {
      pendingValueRef.current = null;
      isPendingRef.current = false;

      if (!isMountedRef.current) return;

      onSaveStart?.();

      try {
        await saveFn(valueToSave);

        if (!isMountedRef.current) return;

        onSaveComplete?.();
      } catch (err) {
        if (!isMountedRef.current) return;

        const error = err instanceof Error ? err : new Error(String(err));
        onSaveError?.(error);
      }
    },
    [saveFn, onSaveStart, onSaveComplete, onSaveError]
  );

  /**
   * Schedule a debounced save.
   */
  const scheduleSave = useCallback(
    (value: T) => {
      // Store pending value
      pendingValueRef.current = value;
      isPendingRef.current = true;

      // Clear existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // Schedule save
      timerRef.current = setTimeout(() => {
        const valueToSave = pendingValueRef.current;
        if (valueToSave !== null) {
          performSave(valueToSave);
        }
      }, delayMs);
    },
    [delayMs, performSave]
  );

  /**
   * Cancel any pending save.
   */
  const cancelPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingValueRef.current = null;
    isPendingRef.current = false;
  }, []);

  return {
    scheduleSave,
    cancelPending,
    get isPending() {
      return isPendingRef.current;
    },
  };
}
