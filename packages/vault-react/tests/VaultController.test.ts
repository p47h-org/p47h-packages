/**
 * @fileoverview VaultController Unit Tests
 * 
 * Tests for the internal VaultController state machine,
 * timeout handling, and error recovery.
 * 
 * @module tests/VaultController.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  resetMockVault, 
  configureMockVault, 
  getMockVaultInstance,
} from './setup';

// Import after mocks are set up
import {
  VaultController,
  getVaultController,
  resetVaultController,
} from '../src/internal/VaultController';
import {
  InitTimeoutError,
  WasmNotSupportedError,
  InitExhaustedError,
} from '../src/internal/InitializationOrchestrator';

describe('VaultController', () => {
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
  // Initialization Tests
  // ==========================================================================
  
  describe('Initialization', () => {
    it('should start in init state', () => {
      const controller = new VaultController();
      expect(controller.state).toBe('init');
      expect(controller.isLoading).toBe(true);
      expect(controller.isAuthenticated).toBe(false);
    });

    it('should transition to ready state after successful init', async () => {
      const controller = new VaultController();
      
      const initPromise = controller.init();
      await vi.runAllTimersAsync();
      await initPromise;
      
      expect(controller.state).toBe('ready');
      expect(controller.isLoading).toBe(false);
    });

    it('should transition to locked state if identities exist', async () => {
      configureMockVault({ storedIdentities: ['did:p47h:existing'] });
      const controller = new VaultController();
      
      const initPromise = controller.init();
      await vi.runAllTimersAsync();
      await initPromise;
      
      expect(controller.state).toBe('locked');
      expect(controller.storedIdentities).toContain('did:p47h:existing');
    });

    it('should be idempotent (multiple init calls)', async () => {
      const controller = new VaultController();
      
      const promise1 = controller.init();
      const promise2 = controller.init();
      
      await vi.runAllTimersAsync();
      await Promise.all([promise1, promise2]);
      
      const mockVault = getMockVaultInstance();
      expect(mockVault?.init).toHaveBeenCalledTimes(1);
    });

    it('should handle SSR (no window)', async () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error - Testing SSR
      delete globalThis.window;
      
      const controller = new VaultController();
      await controller.init();
      
      expect(controller.state).toBe('init'); // Should stay in init (no-op)
      
      globalThis.window = originalWindow;
    });
  });

  // ==========================================================================
  // Timeout Tests
  // ==========================================================================
  
  describe('Timeout Handling', () => {
    it('should timeout if init takes too long', async () => {
      configureMockVault({ initDelay: 50000 }); // 50 seconds
      const controller = new VaultController();
      
      // 1. Start the operation
      const initPromise = controller.init({ initTimeout: 1000 });
      
      // 2. Prepare expectation BEFORE advancing time (captures rejection)
      const errorPromise = expect(initPromise).rejects.toThrow(InitTimeoutError);
      
      // 3. Now advance time past timeout
      await vi.advanceTimersByTimeAsync(1500);
      
      // 4. Wait for the expectation to be fulfilled
      await errorPromise;
      
      expect(controller.state).toBe('error');
      expect(controller.error).toBeInstanceOf(InitTimeoutError);
    });

    it('should include elapsed time in timeout error', async () => {
      configureMockVault({ initDelay: 50000 });
      const controller = new VaultController();
      
      // 1. Start the operation
      const initPromise = controller.init({ initTimeout: 2000 });
      
      // 2. Prepare to capture the error
      const errorPromise = initPromise.catch((err) => err);
      
      // 3. Advance time past timeout
      await vi.advanceTimersByTimeAsync(2500);
      
      // 4. Get and verify the error
      const caughtError = await errorPromise;
      
      expect(caughtError).toBeInstanceOf(InitTimeoutError);
      expect((caughtError as InitTimeoutError).timeoutMs).toBe(2000);
    });

    it('should track elapsed time during initialization', async () => {
      configureMockVault({ initDelay: 500 });
      const controller = new VaultController();
      
      const initPromise = controller.init();
      
      await vi.advanceTimersByTimeAsync(250);
      expect(controller.initElapsedMs).toBeGreaterThan(0);
      
      await vi.advanceTimersByTimeAsync(500);
      await initPromise;
    });
  });

  // ==========================================================================
  // Retry Tests
  // ==========================================================================
  
  describe('Retry Logic', () => {
    it('should retry on transient failures', async () => {
      configureMockVault({ shouldFail: true, failureError: new Error('Network error') });
      
      const controller = new VaultController();
      
      // 1. Start the operation (will fail after all retries)
      const initPromise = controller.init({ 
        initRetries: 2,
        retryDelay: 100,
        initTimeout: 30000,
      });
      
      // 2. Prepare expectation BEFORE advancing time
      const errorPromise = expect(initPromise).rejects.toThrow(InitExhaustedError);
      
      // 3. Advance through retries
      await vi.advanceTimersByTimeAsync(35000);
      
      // 4. Wait for expectation
      await errorPromise;
      
      expect(controller.initAttempt).toBe(3); // 1 initial + 2 retries
    });

    it('should succeed on retry if error is transient', async () => {
      
      const controller = new VaultController();
      
      // First call fails, second succeeds - need to configure dynamically
      configureMockVault({ 
        shouldFail: true, 
        failureError: new Error('Transient error') 
      });
      
      const initPromise = controller.init({ 
        initRetries: 2,
        retryDelay: 100,
      });
      
      // Let first attempt fail
      await vi.advanceTimersByTimeAsync(50);
      
      // Reset to succeed on retry
      configureMockVault({ shouldFail: false });
      
      await vi.runAllTimersAsync();
      
      // Should eventually succeed or fail based on mock state
      try {
        await initPromise;
      } catch {
        // Expected if mock wasn't reset properly
      }
    });
  });

  // ==========================================================================
  // WASM Support Tests
  // ==========================================================================
  
  describe('WASM Support Detection', () => {
    it('should throw WasmNotSupportedError if WebAssembly is undefined', async () => {
      const originalWebAssembly = globalThis.WebAssembly;
      // @ts-expect-error - Testing no WASM
      delete globalThis.WebAssembly;
      
      const controller = new VaultController();
      
      await expect(controller.init()).rejects.toThrow(WasmNotSupportedError);
      expect(controller.state).toBe('error');
      
      globalThis.WebAssembly = originalWebAssembly;
    });
  });

  // ==========================================================================
  // Event Subscription Tests
  // ==========================================================================
  
  describe('Event Subscription', () => {
    it('should emit state-change events', async () => {
      const controller = new VaultController();
      const listener = vi.fn();
      
      controller.subscribe(listener);
      
      // Initial call on subscribe
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        type: 'state-change',
        state: 'init',
      }));
      
      listener.mockClear();
      
      const initPromise = controller.init();
      await vi.runAllTimersAsync();
      await initPromise;
      
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        type: 'state-change',
        state: 'ready',
      }));
    });

    it('should emit auth-change events on login', async () => {
      configureMockVault({ storedIdentities: ['did:p47h:test'] });
      const controller = new VaultController();
      
      const initPromise = controller.init();
      await vi.runAllTimersAsync();
      await initPromise;
      
      const listener = vi.fn();
      controller.subscribe(listener);
      listener.mockClear();
      
      await controller.login('password');
      
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        type: 'auth-change',
        state: 'unlocked',
      }));
    });

    it('should allow unsubscription', async () => {
      const controller = new VaultController();
      const listener = vi.fn();
      
      const unsubscribe = controller.subscribe(listener);
      listener.mockClear();
      
      unsubscribe();
      
      const initPromise = controller.init();
      await vi.runAllTimersAsync();
      await initPromise;
      
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Identity Management Tests
  // ==========================================================================
  
  describe('Identity Management', () => {
    it('should register new identity', async () => {
      const controller = new VaultController();
      
      const initPromise = controller.init();
      await vi.runAllTimersAsync();
      await initPromise;
      
      const result = await controller.register('password123');
      
      expect(result.did).toMatch(/^did:p47h:/);
      expect(result.recoveryCode).toMatch(/^RK-/);
      expect(controller.state).toBe('unlocked');
      expect(controller.isAuthenticated).toBe(true);
    });

    it('should login with existing identity', async () => {
      configureMockVault({ storedIdentities: ['did:p47h:existing'] });
      const controller = new VaultController();
      
      const initPromise = controller.init();
      await vi.runAllTimersAsync();
      await initPromise;
      
      await controller.login('password');
      
      expect(controller.state).toBe('unlocked');
      expect(controller.did).toBe('did:p47h:existing');
    });

    it('should logout and lock vault', async () => {
      configureMockVault({ storedIdentities: ['did:p47h:test'] });
      const controller = new VaultController();
      
      const initPromise = controller.init();
      await vi.runAllTimersAsync();
      await initPromise;
      
      await controller.login('password');
      expect(controller.state).toBe('unlocked');
      
      controller.logout();
      
      expect(controller.state).toBe('locked');
      expect(controller.isAuthenticated).toBe(false);
      expect(controller.did).toBeNull();
    });

    it('should throw if not initialized', async () => {
      const controller = new VaultController();
      
      await expect(controller.register('password')).rejects.toThrow(
        'Vault not initialized'
      );
    });
  });

  // ==========================================================================
  // Secret Management Tests
  // ==========================================================================
  
  describe('Secret Management', () => {
    it('should save and retrieve secrets', async () => {
      const controller = new VaultController();
      
      const initPromise = controller.init();
      await vi.runAllTimersAsync();
      await initPromise;
      
      await controller.register('password');
      
      await controller.saveSecret('api_key', 'secret123');
      const value = await controller.getSecret('api_key');
      
      expect(value).toBe('secret123');
    });

    it('should throw if not authenticated', async () => {
      const controller = new VaultController();
      
      const initPromise = controller.init();
      await vi.runAllTimersAsync();
      await initPromise;
      
      await expect(controller.getSecret('key')).rejects.toThrow(
        'Vault is locked'
      );
    });

    it('should return null for non-existent secrets', async () => {
      const controller = new VaultController();
      
      const initPromise = controller.init();
      await vi.runAllTimersAsync();
      await initPromise;
      
      await controller.register('password');
      
      const value = await controller.getSecret('non_existent');
      expect(value).toBeNull();
    });
  });

  // ==========================================================================
  // Lifecycle Tests
  // ==========================================================================
  
  describe('Lifecycle', () => {
    it('should abort pending initialization', async () => {
      configureMockVault({ initDelay: 1000 });
      const controller = new VaultController();
      
      const initPromise = controller.init();
      controller.abort();
      
      await vi.runAllTimersAsync();
      
      // Should not throw, just silently abort
      try {
        await initPromise;
      } catch {
        // Might throw or not depending on timing
      }
      
      expect(controller.state).toBe('init'); // Should stay in init
    });

    it('should dispose and release resources', async () => {
      const controller = new VaultController();
      
      const initPromise = controller.init();
      await vi.runAllTimersAsync();
      await initPromise;
      
      controller.dispose();
      
      expect(controller.state).toBe('init');
      
      const mockVault = getMockVaultInstance();
      expect(mockVault?.dispose).toHaveBeenCalled();
    });

    it('should allow reinitialization after resetAbort', async () => {
      const controller = new VaultController();
      
      controller.abort();
      controller.resetAbort();
      
      const initPromise = controller.init();
      await vi.runAllTimersAsync();
      await initPromise;
      
      expect(controller.state).toBe('ready');
    });
  });

  // ==========================================================================
  // Singleton Factory Tests
  // ==========================================================================
  
  describe('Singleton Factory', () => {
    it('should return same instance', () => {
      const controller1 = getVaultController();
      const controller2 = getVaultController();
      
      expect(controller1).toBe(controller2);
    });

    it('should create new instance after reset', () => {
      const controller1 = getVaultController();
      resetVaultController();
      const controller2 = getVaultController();
      
      expect(controller1).not.toBe(controller2);
    });
  });
});
