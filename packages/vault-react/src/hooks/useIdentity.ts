/**
 * @fileoverview useIdentity - Identity Management Hook
 * 
 * High-level hook for managing vault identity (login/register/logout).
 * 
 * @module hooks/useIdentity
 * @license Apache-2.0
 */

import { useCallback, useState } from 'react';
import { useP47h } from './useP47h';
import type { UseIdentityReturn } from '../types';

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing vault identity lifecycle.
 * 
 * Provides methods for:
 * - Registering new identities
 * - Logging in with existing identities
 * - Logging out (locking the vault)
 * - Account recovery
 * 
 * @returns Identity state and management functions
 * 
 * @example Basic login/logout
 * ```tsx
 * function AuthSection() {
 *   const { isAuthenticated, login, logout, isLoading, error } = useIdentity();
 *   
 *   if (isLoading) return <div>Loading...</div>;
 *   
 *   if (isAuthenticated) {
 *     return <button onClick={logout}>Lock Vault</button>;
 *   }
 *   
 *   return (
 *     <button onClick={() => login('my-password')}>
 *       Unlock Vault
 *     </button>
 *   );
 * }
 * ```
 * 
 * @example Registration with recovery code
 * ```tsx
 * function RegisterForm() {
 *   const { register, isLoading } = useIdentity();
 *   const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
 *   
 *   const handleRegister = async (password: string) => {
 *     const result = await register(password);
 *     setRecoveryCode(result.recoveryCode);
 *     // IMPORTANT: Show recovery code to user!
 *   };
 *   
 *   if (recoveryCode) {
 *     return (
 *       <div>
 *         <h2>⚠️ Save your recovery code!</h2>
 *         <code>{recoveryCode}</code>
 *         <p>This is the only way to recover your vault if you forget your password.</p>
 *       </div>
 *     );
 *   }
 *   
 *   return (
 *     <form onSubmit={(e) => {
 *       e.preventDefault();
 *       const password = new FormData(e.currentTarget).get('password');
 *       if (password) handleRegister(password.toString());
 *     }}>
 *       <input name="password" type="password" placeholder="Password" />
 *       <button type="submit" disabled={isLoading}>
 *         {isLoading ? 'Creating...' : 'Create Vault'}
 *       </button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useIdentity(): UseIdentityReturn {
  const context = useP47h();
  
  // Local loading state for async operations
  const [isOperationLoading, setIsOperationLoading] = useState(false);
  const [localError, setLocalError] = useState<Error | null>(null);
  
  // Wrapped register with loading state
  const register = useCallback(async (password: string) => {
    setIsOperationLoading(true);
    setLocalError(null);
    
    try {
      const result = await context.register(password);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setLocalError(error);
      throw error;
    } finally {
      setIsOperationLoading(false);
    }
  }, [context]);
  
  // Wrapped login with loading state
  const login = useCallback(async (password: string, did?: string) => {
    setIsOperationLoading(true);
    setLocalError(null);
    
    try {
      await context.login(password, did);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setLocalError(error);
      throw error;
    } finally {
      setIsOperationLoading(false);
    }
  }, [context]);
  
  // Logout doesn't need async handling
  const logout = useCallback(() => {
    setLocalError(null);
    context.logout();
  }, [context]);
  
  // Wrapped recover with loading state
  const recover = useCallback(async (recoveryCode: string, newPassword: string) => {
    setIsOperationLoading(true);
    setLocalError(null);
    
    try {
      await context.recover(recoveryCode, newPassword);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setLocalError(error);
      throw error;
    } finally {
      setIsOperationLoading(false);
    }
  }, [context]);
  
  return {
    did: context.did,
    isAuthenticated: context.isAuthenticated,
    isLoading: context.isLoading || isOperationLoading,
    error: localError ?? context.error,
    storedIdentities: context.storedIdentities,
    register,
    login,
    logout,
    recover,
  };
}
