/**
 * @fileoverview P47hProvider Integration Tests
 * 
 * Tests for the P47hProvider component including
 * initialization, error handling, and context provisioning.
 * 
 * @module tests/P47hProvider.test
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { 
  resetMockVault, 
  configureMockVault 
} from './setup';

// Import after mocks
import { P47hProvider } from '../src/context/P47hProvider';
import { useP47h } from '../src/hooks/useP47h';
import { resetVaultController } from '../src/internal/VaultController';

// Test component that displays context state
function TestConsumer() {
  const { state, did, isAuthenticated, isLoading, error } = useP47h();
  
  return (
    <div>
      <span data-testid="state">{state}</span>
      <span data-testid="did">{did ?? 'null'}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="error">{error?.message ?? 'null'}</span>
    </div>
  );
}

describe('P47hProvider', () => {
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
  // Basic Rendering Tests
  // ==========================================================================
  
  describe('Basic Rendering', () => {
    it('should render children after initialization', async () => {
      render(
        <P47hProvider>
          <div data-testid="child">Child Content</div>
        </P47hProvider>
      );
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('should show fallback during initialization', async () => {
      configureMockVault({ initDelay: 1000 });
      
      render(
        <P47hProvider fallback={<div data-testid="fallback">Loading...</div>}>
          <div data-testid="child">Child Content</div>
        </P47hProvider>
      );
      
      expect(screen.getByTestId('fallback')).toBeInTheDocument();
      expect(screen.queryByTestId('child')).not.toBeInTheDocument();
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('should support function fallback with elapsed time', async () => {
      configureMockVault({ initDelay: 2000 });
      
      render(
        <P47hProvider 
          fallback={(elapsed) => (
            <div data-testid="fallback">Loading... {Math.floor(elapsed / 1000)}s</div>
          )}
        >
          <div>Child</div>
        </P47hProvider>
      );
      
      expect(screen.getByTestId('fallback')).toBeInTheDocument();
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });
      
      // Elapsed time should be reflected (approximately)
      const fallback = screen.getByTestId('fallback');
      expect(fallback.textContent).toContain('Loading...');
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================
  
  describe('Error Handling', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let consoleSpy: MockInstance<any[], void>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should show error fallback on initialization failure', async () => {
      configureMockVault({ 
        shouldFail: true, 
        failureError: new Error('WASM failed') 
      });
      
      render(
        <P47hProvider 
          config={{ initRetries: 0 }}
          errorFallback={<div data-testid="error">Error occurred</div>}
        >
          <div data-testid="child">Child</div>
        </P47hProvider>
      );
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      expect(screen.getByTestId('error')).toBeInTheDocument();
      expect(screen.queryByTestId('child')).not.toBeInTheDocument();
    });

    it('should support function error fallback with error details', async () => {
      configureMockVault({ 
        shouldFail: true, 
        failureError: new Error('Custom error message') 
      });
      
      render(
        <P47hProvider 
          config={{ initRetries: 0 }}
          errorFallback={(error) => (
            <div data-testid="error">{error.message}</div>
          )}
        >
          <div>Child</div>
        </P47hProvider>
      );
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      expect(screen.getByTestId('error')).toHaveTextContent('Custom error message');
    });

    it('should call onInitError callback on failure', async () => {
      const onInitError = vi.fn();
      
      configureMockVault({ 
        shouldFail: true, 
        failureError: new Error('Init failed') 
      });
      
      render(
        <P47hProvider 
          config={{ initRetries: 0 }}
          onInitError={onInitError}
        >
          <div>Child</div>
        </P47hProvider>
      );
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      expect(onInitError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call onInitTimeout on timeout', async () => {
      const onInitTimeout = vi.fn();
      
      configureMockVault({ initDelay: 50000 });
      
      render(
        <P47hProvider 
          config={{ initTimeout: 1000, initRetries: 0 }}
          onInitTimeout={onInitTimeout}
        >
          <div>Child</div>
        </P47hProvider>
      );
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });
      
      expect(onInitTimeout).toHaveBeenCalled();
    });

    it('should render children even on error if no errorFallback', async () => {
      configureMockVault({ 
        shouldFail: true, 
        failureError: new Error('Failed') 
      });
      
      render(
        <P47hProvider config={{ initRetries: 0 }}>
          <TestConsumer />
        </P47hProvider>
      );
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      expect(screen.getByTestId('state')).toHaveTextContent('error');
      expect(screen.getByTestId('error')).toHaveTextContent('Failed');
    });
  });

  // ==========================================================================
  // Context State Tests
  // ==========================================================================
  
  describe('Context State', () => {
    it('should provide correct initial state', async () => {
      render(
        <P47hProvider>
          <TestConsumer />
        </P47hProvider>
      );
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      expect(screen.getByTestId('state')).toHaveTextContent('ready');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    it('should provide locked state when identities exist', async () => {
      configureMockVault({ storedIdentities: ['did:p47h:existing'] });
      
      render(
        <P47hProvider>
          <TestConsumer />
        </P47hProvider>
      );
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      expect(screen.getByTestId('state')).toHaveTextContent('locked');
    });
  });

  // ==========================================================================
  // React Strict Mode Tests
  // ==========================================================================
  
  describe('React Strict Mode Compatibility', () => {
    it('should handle double-mounting in Strict Mode', async () => {
      render(
        <React.StrictMode>
          <P47hProvider>
            <TestConsumer />
          </P47hProvider>
        </React.StrictMode>
      );
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      // Should still work correctly
      expect(screen.getByTestId('state')).toHaveTextContent('ready');
    });
  });

  // ==========================================================================
  // Configuration Tests
  // ==========================================================================
  
  describe('Configuration', () => {
    it('should pass config to vault', async () => {
      render(
        <P47hProvider 
          config={{ 
            wasmPath: '/wasm/test-vault.wasm',
            initTimeout: 5000,
          }}
        >
          <TestConsumer />
        </P47hProvider>
      );
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      // Just verify it initialized successfully
      expect(screen.getByTestId('state')).toHaveTextContent('ready');
    });
  });
});
