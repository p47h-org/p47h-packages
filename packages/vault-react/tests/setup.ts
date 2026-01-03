/**
 * @fileoverview Test Setup - Mocks and Utilities
 * 
 * Provides mock implementations of @p47h/vault-js for testing
 * without actual WASM dependencies.
 * 
 * @module tests/setup
 */

import '@testing-library/jest-dom';
import { vi, beforeAll, afterAll } from 'vitest';
import type { VaultConfig } from '@p47h/vault-js';

// ============================================================================
// Suppress Expected Unhandled Rejections
// ============================================================================

// The InitializationOrchestrator creates timeout promises that may reject
// after the main promise settles (Promise.race pattern). These are expected
// in timeout/retry tests and should not cause test failures.

function isExpectedRejection(reason: unknown): boolean {
  if (!reason || typeof reason !== 'object') return false;
  const r = reason as { name?: string; constructor?: { name?: string } };
  return (
    r.name === 'InitTimeoutError' ||
    r.name === 'InitExhaustedError' ||
    r.constructor?.name === 'InitTimeoutError' ||
    r.constructor?.name === 'InitExhaustedError'
  );
}

let windowHandler: ((event: PromiseRejectionEvent) => void) | null = null;
let processHandler: ((reason: unknown, promise: Promise<unknown>) => void) | null = null;

beforeAll(() => {
  // Window handler for jsdom environment
  if (typeof window !== 'undefined') {
    windowHandler = (event: PromiseRejectionEvent) => {
      if (isExpectedRejection(event.reason)) {
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', windowHandler);
  }
  
  // Process handler for Node.js 
  processHandler = (reason: unknown) => {
    if (isExpectedRejection(reason)) {
      // Suppress - this is expected from Promise.race timeout pattern
      return;
    }
  };
  process.on('unhandledRejection', processHandler);
});

afterAll(() => {
  if (typeof window !== 'undefined' && windowHandler) {
    window.removeEventListener('unhandledrejection', windowHandler);
  }
  if (processHandler) {
    process.off('unhandledRejection', processHandler);
  }
});

// ============================================================================
// Mock Types
// ============================================================================

export interface MockVaultState {
  initialized: boolean;
  authenticated: boolean;
  did: string | null;
  secrets: Map<string, string>;
  storedIdentities: string[];
}

// ============================================================================
// Mock Implementation
// ============================================================================

/**
 * Creates a mock VaultService instance.
 */
export function createMockVault(initialState?: Partial<MockVaultState>) {
  const state: MockVaultState = {
    initialized: false,
    authenticated: false,
    did: null,
    secrets: new Map(),
    storedIdentities: initialState?.storedIdentities ?? [],
    ...initialState,
  };

  return {
    // State
    _state: state,
    
    // Initialization
    init: vi.fn().mockImplementation(async () => {
      state.initialized = true;
    }),
    
    // Identity
    register: vi.fn().mockImplementation(async () => {
      if (!state.initialized) throw new Error('Not initialized');
      const did = `did:p47h:mock_${Date.now()}`;
      state.did = did;
      state.authenticated = true;
      state.storedIdentities.push(did);
      return {
        did,
        recoveryCode: 'RK-MOCK-1234-5678-ABCD-EFGH',
      };
    }),
    
    login: vi.fn().mockImplementation(async (_password: string, did?: string) => {
      if (!state.initialized) throw new Error('Not initialized');
      if (state.storedIdentities.length === 0) {
        throw new Error('No identities found');
      }
      const targetDid = did ?? state.storedIdentities[0];
      if (!targetDid) throw new Error('No identity to login');
      state.did = targetDid;
      state.authenticated = true;
      return {
        did: targetDid,
        publicKey: new Uint8Array(32),
      };
    }),
    
    lock: vi.fn().mockImplementation(() => {
      state.authenticated = false;
      state.did = null;
    }),
    
    recoverAccount: vi.fn().mockImplementation(async () => {
      return { did: state.storedIdentities[0] ?? 'did:p47h:recovered' };
    }),
    
    isAuthenticated: vi.fn().mockImplementation(() => state.authenticated),
    
    getDid: vi.fn().mockImplementation(() => {
      if (!state.authenticated) throw new Error('Not authenticated');
      return state.did;
    }),
    
    getStoredIdentities: vi.fn().mockImplementation(async () => {
      return [...state.storedIdentities];
    }),
    
    // Secrets
    saveSecret: vi.fn().mockImplementation(async (key: string, value: string) => {
      if (!state.authenticated) throw new Error('Not authenticated');
      state.secrets.set(key, value);
    }),
    
    getSecret: vi.fn().mockImplementation(async (key: string) => {
      if (!state.authenticated) throw new Error('Not authenticated');
      return state.secrets.get(key) ?? null;
    }),
    
    // Licensing
    isCommercialLicense: vi.fn().mockReturnValue(false),
    getLicensee: vi.fn().mockReturnValue(null),
    
    // Lifecycle
    dispose: vi.fn().mockImplementation(() => {
      state.initialized = false;
      state.authenticated = false;
      state.did = null;
    }),
  };
}

// ============================================================================
// Mock Factory
// ============================================================================

// Global mock configuration object - must be accessible from vi.mock hoisted context
const mockConfig = {
  instance: null as ReturnType<typeof createMockVault> | null,
  initDelay: 0,
  shouldFail: false,
  failureError: null as Error | null,
  pendingStoredIdentities: [] as string[],
};

// Export for access from mock factory (vi.mock is hoisted)
(globalThis as any).__p47hMockConfig = mockConfig;

/**
 * Configure the mock vault behavior.
 */
export function configureMockVault(options: {
  initDelay?: number;
  shouldFail?: boolean;
  failureError?: Error;
  storedIdentities?: string[];
} = {}) {
  mockConfig.initDelay = options.initDelay ?? 0;
  mockConfig.shouldFail = options.shouldFail ?? false;
  mockConfig.failureError = options.failureError ?? null;
  mockConfig.pendingStoredIdentities = options.storedIdentities ?? [];
  
  // Also update existing instance if available
  if (mockConfig.instance) {
    mockConfig.instance._state.storedIdentities = [...mockConfig.pendingStoredIdentities];
  }
}

/**
 * Reset mock vault state.
 */
export function resetMockVault() {
  mockConfig.instance = null;
  mockConfig.initDelay = 0;
  mockConfig.shouldFail = false;
  mockConfig.failureError = null;
  mockConfig.pendingStoredIdentities = [];
}

/**
 * Get the current mock vault instance.
 */
export function getMockVaultInstance() {
  return mockConfig.instance;
}

// ============================================================================
// Module Mock
// ============================================================================

// Mock the @p47h/vault-js module
vi.mock('@p47h/vault-js', () => {
  // Access config through globalThis (vi.mock is hoisted)
  const getConfig = () => (globalThis as any).__p47hMockConfig || {
    instance: null,
    initDelay: 0,
    shouldFail: false,
    failureError: null,
    pendingStoredIdentities: [],
  };
  
  return {
    P47hVault: vi.fn().mockImplementation(() => {
      const config = getConfig();
      
      // Create mock with pending stored identities from configureMockVault
      const instance = createMockVault({
        storedIdentities: [...config.pendingStoredIdentities]
      });
      config.instance = instance;
      
      // Override init to add delay and failure simulation
      const originalInit = instance.init;
      instance.init = vi.fn().mockImplementation(async (_cfg?: VaultConfig) => {
        const currentConfig = getConfig();
        
        if (currentConfig.initDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, currentConfig.initDelay));
        }
        
        if (currentConfig.shouldFail) {
          throw currentConfig.failureError ?? new Error('Mock initialization failed');
        }
        
        return originalInit(_cfg);
      });
      
      return instance;
    }),
    
    // Error classes
    VaultError: class VaultError extends Error {
      constructor(message: string, public code?: string) {
        super(message);
        this.name = 'VaultError';
      }
    },
    AuthenticationError: class AuthenticationError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'AuthenticationError';
      }
    },
    NotAuthenticatedError: class NotAuthenticatedError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'NotAuthenticatedError';
      }
    },
    InitializationError: class InitializationError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'InitializationError';
      }
    },
    StorageError: class StorageError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'StorageError';
      }
    },
    CryptoError: class CryptoError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'CryptoError';
      }
    },
  };
});

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Wait for a condition to be true.
 */
export async function waitFor(
  condition: () => boolean,
  timeout = 5000,
  interval = 50
): Promise<void> {
  const startTime = Date.now();
  
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`waitFor timed out after ${timeout}ms`);
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

/**
 * Flush all pending promises and timers.
 */
export async function flushPromises(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Advance timers safely without triggering infinite loop from setInterval.
 * Use this instead of vi.runAllTimersAsync() in tests with P47hProvider.
 */
export async function advanceTimersSafely(ms = 5000): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}
