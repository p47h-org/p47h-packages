/**
 * @fileoverview P47hProvider - Main Context Provider
 * 
 * [PARCHE 1] This provider uses VaultController for state management,
 * ensuring compatibility with React Strict Mode and SSR.
 * 
 * The provider:
 * - Initializes the VaultController on mount
 * - Subscribes to controller events for reactivity
 * - Handles cleanup on unmount (Strict Mode safe)
 * - Provides fallback UI during initialization
 * - Handles initialization timeout with visual feedback
 * - Supports error callbacks for analytics
 * 
 * @module context/P47hProvider
 * @license Apache-2.0
 */

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { P47hContext } from './P47hContext';
import { getVaultController, VaultController } from '../internal/VaultController';
import { InitTimeoutError } from '../internal/InitializationOrchestrator';
import type {
  P47hProviderProps,
  P47hContextValue,
  VaultState,
  VaultEvent,
} from '../types';

// ============================================================================
// Constants
// ============================================================================

/** Interval for updating elapsed time display (ms) */
const ELAPSED_UPDATE_INTERVAL_MS = 100;

// ============================================================================
// Provider Component
// ============================================================================

/**
 * P47H Vault Provider component.
 * 
 * Wraps your application to provide encrypted vault functionality
 * through React Context. Handles WASM initialization automatically.
 * 
 * @example
 * ```tsx
 * import { P47hProvider } from '@p47h/vault-react';
 * 
 * function App() {
 *   return (
 *     <P47hProvider fallback={<div>Loading vault…</div>}>
 *       <MyApp />
 *     </P47hProvider>
 *   );
 * }
 * ```
 * 
 * @example With timeout handling
 * ```tsx
 * <P47hProvider 
 *   config={{ initTimeout: 15000 }}
 *   fallback={(elapsed) => (
 *     <div>
 *       Loading vault… ({Math.floor(elapsed / 1000)}s)
 *       {elapsed > 5000 && <p>This is taking longer than usual...</p>}
 *     </div>
 *   )}
 *   errorFallback={(error) => <ErrorPage error={error} />}
 *   onInitTimeout={(elapsed) => analytics.track('vault_timeout', { elapsed })}
 * >
 *   <MyApp />
 * </P47hProvider>
 * ```
 */
export function P47hProvider({
  children,
  config,
  fallback = null,
  errorFallback,
  onInitTimeout,
  onInitError,
}: P47hProviderProps): React.ReactElement {
  // Get the singleton controller
  const controllerRef = useRef<VaultController | null>(null);
  
  // Local state synced with controller
  const [state, setState] = useState<VaultState>('init');
  const [did, setDid] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [storedIdentities, setStoredIdentities] = useState<string[]>([]);
  
  // Elapsed time for fallback UI
  const [elapsedMs, setElapsedMs] = useState(0);
  
  // Track if component is mounted (for async safety)
  const isMountedRef = useRef(true);
  
  // Track if timeout callback has been fired
  const timeoutFiredRef = useRef(false);

  // ============================================================================
  // Elapsed Time Tracking
  // ============================================================================
  
  useEffect(() => {
    // Only track elapsed time during initialization
    if (state !== 'init') {
      return;
    }
    
    const interval = setInterval(() => {
      const controller = controllerRef.current;
      if (controller && isMountedRef.current) {
        setElapsedMs(controller.initElapsedMs);
      }
    }, ELAPSED_UPDATE_INTERVAL_MS);
    
    return () => clearInterval(interval);
  }, [state]);

  // ============================================================================
  // Controller Initialization
  // ============================================================================
  
  useEffect(() => {
    isMountedRef.current = true;
    timeoutFiredRef.current = false;
    
    // Get or create controller
    const controller = getVaultController();
    controllerRef.current = controller;
    
    // Reset abort flag in case of remount (Strict Mode)
    controller.resetAbort();
    
    // Subscribe to controller events
    const unsubscribe = controller.subscribe((event: VaultEvent) => {
      if (!isMountedRef.current) return;
      
      setState(event.state);
      setDid(event.did);
      setError(event.error);
      setStoredIdentities(controller.storedIdentities);
      
      // Fire error callback
      if (event.state === 'error' && event.error) {
        onInitError?.(event.error);
        
        // Fire timeout callback specifically for timeout errors
        if (
          event.error instanceof InitTimeoutError && 
          !timeoutFiredRef.current
        ) {
          timeoutFiredRef.current = true;
          onInitTimeout?.(event.error.elapsedMs);
        }
      }
    });
    
    // Initialize the vault
    controller.init(config).catch((err) => {
      // Error already handled by controller and subscription
      console.error('[P47hProvider] Initialization failed:', err);
    });
    
    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      controller.abort();
      unsubscribe();
    };
  }, []); // Empty deps: only run on mount/unmount

  // ============================================================================
  // Context Methods (Stable References)
  // ============================================================================
  
  const register = useCallback(async (password: string) => {
    const controller = controllerRef.current;
    if (!controller) {
      throw new Error('Provider not mounted');
    }
    return controller.register(password);
  }, []);
  
  const login = useCallback(async (password: string, targetDid?: string) => {
    const controller = controllerRef.current;
    if (!controller) {
      throw new Error('Provider not mounted');
    }
    await controller.login(password, targetDid);
  }, []);
  
  const logout = useCallback(() => {
    const controller = controllerRef.current;
    if (controller) {
      controller.logout();
    }
  }, []);
  
  const recover = useCallback(async (recoveryCode: string, newPassword: string) => {
    const controller = controllerRef.current;
    if (!controller) {
      throw new Error('Provider not mounted');
    }
    await controller.recover(recoveryCode, newPassword);
  }, []);
  
  const getSecret = useCallback(async (key: string) => {
    const controller = controllerRef.current;
    if (!controller) {
      throw new Error('Provider not mounted');
    }
    return controller.getSecret(key);
  }, []);
  
  const saveSecret = useCallback(async (key: string, value: string) => {
    const controller = controllerRef.current;
    if (!controller) {
      throw new Error('Provider not mounted');
    }
    await controller.saveSecret(key, value);
  }, []);

  // ============================================================================
  // Context Value
  // ============================================================================
  
  const contextValue = useMemo<P47hContextValue>(() => ({
    state,
    did,
    isAuthenticated: state === 'unlocked' && did !== null,
    isLoading: state === 'init',
    error,
    storedIdentities,
    register,
    login,
    logout,
    recover,
    getSecret,
    saveSecret,
  }), [
    state, 
    did, 
    error, 
    storedIdentities,
    register, 
    login, 
    logout, 
    recover, 
    getSecret, 
    saveSecret
  ]);

  // ============================================================================
  // Render
  // ============================================================================
  
  // Show error fallback on fatal errors
  if (state === 'error' && error && errorFallback) {
    return (
      <P47hContext.Provider value={contextValue}>
        {typeof errorFallback === 'function' 
          ? errorFallback(error) 
          : errorFallback
        }
      </P47hContext.Provider>
    );
  }
  
  // Show loading fallback during initialization
  if (state === 'init' && fallback) {
    return (
      <P47hContext.Provider value={contextValue}>
        {typeof fallback === 'function'
          ? fallback(elapsedMs)
          : fallback
        }
      </P47hContext.Provider>
    );
  }
  
  // Show error inline if no errorFallback provided
  if (state === 'error' && error) {
    return (
      <P47hContext.Provider value={contextValue}>
        {children}
      </P47hContext.Provider>
    );
  }
  
  // Normal render
  return (
    <P47hContext.Provider value={contextValue}>
      {children}
    </P47hContext.Provider>
  );
}

// Set display name for React DevTools
P47hProvider.displayName = 'P47hProvider';
