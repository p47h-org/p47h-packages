/**
 * @fileoverview useIdentity Hook Tests
 * 
 * Tests for the useIdentity hook including
 * authentication flows, error handling, and state management.
 * 
 * @module tests/useIdentity.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { resetMockVault, configureMockVault, getMockVaultInstance } from './setup';

// Import after mocks
import { P47hProvider } from '../src/context/P47hProvider';
import { useIdentity } from '../src/hooks/useIdentity';
import { resetVaultController } from '../src/internal/VaultController';

// Test component for useIdentity
function IdentityTestComponent() {
  const {
    did,
    isAuthenticated,
    isLoading,
    error,
    storedIdentities,
    register,
    login,
    logout,
  } = useIdentity();
  
  const [recoveryCode, setRecoveryCode] = React.useState<string | null>(null);
  
  const handleRegister = async () => {
    try {
      const result = await register('password123');
      setRecoveryCode(result.recoveryCode);
    } catch (err) {
      // Error handled by hook
    }
  };
  
  const handleLogin = async () => {
    try {
      await login('password123');
    } catch (err) {
      // Error handled by hook
    }
  };
  
  return (
    <div>
      <span data-testid="did">{did ?? 'null'}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="error">{error?.message ?? 'null'}</span>
      <span data-testid="identities">{storedIdentities.join(',')}</span>
      <span data-testid="recovery">{recoveryCode ?? 'null'}</span>
      
      <button data-testid="register-btn" onClick={handleRegister}>Register</button>
      <button data-testid="login-btn" onClick={handleLogin}>Login</button>
      <button data-testid="logout-btn" onClick={logout}>Logout</button>
    </div>
  );
}

describe('useIdentity', () => {
  beforeEach(() => {
    resetMockVault();
    resetVaultController();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetVaultController();
  });

  // ==========================================================================
  // Initial State Tests
  // ==========================================================================
  
  describe('Initial State', () => {
    it('should have correct initial state', async () => {
      render(
        <P47hProvider>
          <IdentityTestComponent />
        </P47hProvider>
      );
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      expect(screen.getByTestId('did')).toHaveTextContent('null');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    it('should show existing identities', async () => {
      configureMockVault({ storedIdentities: ['did:p47h:one', 'did:p47h:two'] });
      
      render(
        <P47hProvider>
          <IdentityTestComponent />
        </P47hProvider>
      );
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      expect(screen.getByTestId('identities')).toHaveTextContent('did:p47h:one,did:p47h:two');
    });
  });

  // ==========================================================================
  // Registration Tests
  // ==========================================================================
  
  describe('Registration', () => {
    it('should register new identity', async () => {
      render(
        <P47hProvider>
          <IdentityTestComponent />
        </P47hProvider>
      );
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      await act(async () => {
        fireEvent.click(screen.getByTestId('register-btn'));
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      expect(screen.getByTestId('did')).toHaveTextContent('did:p47h:');
      expect(screen.getByTestId('recovery')).toHaveTextContent('RK-');
    });

    it('should show loading state during registration', async () => {
      render(
        <P47hProvider>
          <IdentityTestComponent />
        </P47hProvider>
      );
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      // Start registration
      act(() => {
        fireEvent.click(screen.getByTestId('register-btn'));
      });
      
      // Should be loading immediately
      expect(screen.getByTestId('loading')).toHaveTextContent('true');
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    it('should handle registration errors', async () => {
      render(
        <P47hProvider>
          <IdentityTestComponent />
        </P47hProvider>
      );
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      // Configure mock to fail on register
      const mockVault = getMockVaultInstance();
      mockVault?.register.mockRejectedValueOnce(new Error('Registration failed'));
      
      await act(async () => {
        fireEvent.click(screen.getByTestId('register-btn'));
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      expect(screen.getByTestId('error')).toHaveTextContent('Registration failed');
    });
  });

  // ==========================================================================
  // Login Tests
  // ==========================================================================
  
  describe('Login', () => {
    it('should login with existing identity', async () => {
      configureMockVault({ storedIdentities: ['did:p47h:existing'] });
      
      render(
        <P47hProvider>
          <IdentityTestComponent />
        </P47hProvider>
      );
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      await act(async () => {
        fireEvent.click(screen.getByTestId('login-btn'));
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      expect(screen.getByTestId('did')).toHaveTextContent('did:p47h:existing');
    });

    it('should handle login errors', async () => {
      configureMockVault({ storedIdentities: ['did:p47h:test'] });
      
      render(
        <P47hProvider>
          <IdentityTestComponent />
        </P47hProvider>
      );
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      // Configure mock to fail on login
      const mockVault = getMockVaultInstance();
      mockVault?.login.mockRejectedValueOnce(new Error('Wrong password'));
      
      await act(async () => {
        fireEvent.click(screen.getByTestId('login-btn'));
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      expect(screen.getByTestId('error')).toHaveTextContent('Wrong password');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    });
  });

  // ==========================================================================
  // Logout Tests
  // ==========================================================================
  
  describe('Logout', () => {
    it('should logout and lock vault', async () => {
      configureMockVault({ storedIdentities: ['did:p47h:test'] });
      
      render(
        <P47hProvider>
          <IdentityTestComponent />
        </P47hProvider>
      );
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      // Login first
      await act(async () => {
        fireEvent.click(screen.getByTestId('login-btn'));
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      
      // Now logout
      await act(async () => {
        fireEvent.click(screen.getByTestId('logout-btn'));
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      expect(screen.getByTestId('did')).toHaveTextContent('null');
    });

    it('should clear errors on logout', async () => {
      configureMockVault({ storedIdentities: ['did:p47h:test'] });
      
      render(
        <P47hProvider>
          <IdentityTestComponent />
        </P47hProvider>
      );
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      // Cause an error
      const mockVault = getMockVaultInstance();
      mockVault?.login.mockRejectedValueOnce(new Error('Some error'));
      
      await act(async () => {
        fireEvent.click(screen.getByTestId('login-btn'));
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      expect(screen.getByTestId('error')).toHaveTextContent('Some error');
      
      // Logout should clear error
      await act(async () => {
        fireEvent.click(screen.getByTestId('logout-btn'));
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      expect(screen.getByTestId('error')).toHaveTextContent('null');
    });
  });
});
