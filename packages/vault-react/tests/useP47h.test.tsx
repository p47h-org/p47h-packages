/**
 * @fileoverview useP47h Hook Tests
 * 
 * Tests for the base context access hook.
 * 
 * @module tests/useP47h.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { resetMockVault, configureMockVault } from './setup';

// Import after mocks
import { P47hProvider } from '../src/context/P47hProvider';
import { useP47h } from '../src/hooks/useP47h';
import { resetVaultController } from '../src/internal/VaultController';

// Test component
function TestConsumer() {
  const context = useP47h();
  
  return (
    <div>
      <span data-testid="state">{context.state}</span>
      <span data-testid="did">{context.did ?? 'null'}</span>
      <span data-testid="authenticated">{String(context.isAuthenticated)}</span>
      <span data-testid="loading">{String(context.isLoading)}</span>
    </div>
  );
}

describe('useP47h', () => {
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
  // Basic Usage
  // ==========================================================================
  
  describe('Basic Usage', () => {
    it('should return context value', async () => {
      render(
        <P47hProvider>
          <TestConsumer />
        </P47hProvider>
      );
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      expect(screen.getByTestId('state')).toHaveTextContent('ready');
    });

    it('should reflect loading state during init', async () => {
      configureMockVault({ initDelay: 1000 });
      
      render(
        <P47hProvider>
          <TestConsumer />
        </P47hProvider>
      );
      
      expect(screen.getByTestId('loading')).toHaveTextContent('true');
      expect(screen.getByTestId('state')).toHaveTextContent('init');
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });
  });

  // ==========================================================================
  // Without Provider
  // ==========================================================================
  
  describe('Without Provider', () => {
    it('should throw when calling methods without provider', async () => {
      // The default context value has methods that throw
      const { result } = await new Promise<{ result: any }>((resolve) => {
        let contextValue: any;
        
        function CaptureContext() {
          contextValue = useP47h();
          return null;
        }
        
        render(<CaptureContext />);
        resolve({ result: contextValue });
      });
      
      // Methods should throw helpful errors
      await expect(result.register('password')).rejects.toThrow('No provider');
      await expect(result.login('password')).rejects.toThrow('No provider');
      expect(() => result.logout()).toThrow('No provider');
      await expect(result.recover('code', 'password')).rejects.toThrow('No provider');
      await expect(result.getSecret('key')).rejects.toThrow('No provider');
      await expect(result.saveSecret('key', 'value')).rejects.toThrow('No provider');
    });
  });

  // ==========================================================================
  // Context Updates
  // ==========================================================================
  
  describe('Context Updates', () => {
    it('should update when state changes', async () => {
      configureMockVault({ storedIdentities: ['did:p47h:test'] });
      
      render(
        <P47hProvider>
          <TestConsumer />
        </P47hProvider>
      );
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      // Should reflect locked state
      expect(screen.getByTestId('state')).toHaveTextContent('locked');
    });
  });

  // ==========================================================================
  // Multiple Consumers
  // ==========================================================================
  
  describe('Multiple Consumers', () => {
    it('should provide same state to multiple consumers', async () => {
      render(
        <P47hProvider>
          <div>
            <TestConsumer />
            <TestConsumer />
          </div>
        </P47hProvider>
      );
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      
      const states = screen.getAllByTestId('state');
      expect(states).toHaveLength(2);
      expect(states[0]).toHaveTextContent('ready');
      expect(states[1]).toHaveTextContent('ready');
    });
  });
});
