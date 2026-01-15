/**
 * @fileoverview Property-Based Tests with fast-check
 * 
 * Tests random sequences of vault operations to verify invariants:
 * - After logout, secret is always null
 * - State transitions are always valid
 * - No race conditions in concurrent operations
 * 
 * @module tests/property-based
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { 
  createMockVault, 
  resetMockVault,
  configureMockVault 
} from './setup';

// ============================================================================
// Action Types for Property-Based Testing
// ============================================================================

type VaultAction = 
  | { type: 'init' }
  | { type: 'register'; password: string }
  | { type: 'login'; password: string }
  | { type: 'logout' }
  | { type: 'saveSecret'; key: string; value: string }
  | { type: 'getSecret'; key: string };

// ============================================================================
// Action Generators
// ============================================================================

const actionArbitrary: fc.Arbitrary<VaultAction> = fc.oneof(
  fc.constant({ type: 'init' as const }),
  fc.record({
    type: fc.constant('register' as const),
    password: fc.string({ minLength: 1, maxLength: 20 }),
  }),
  fc.record({
    type: fc.constant('login' as const),
    password: fc.string({ minLength: 1, maxLength: 20 }),
  }),
  fc.constant({ type: 'logout' as const }),
  fc.record({
    type: fc.constant('saveSecret' as const),
    key: fc.string({ minLength: 1, maxLength: 10 }),
    value: fc.string({ minLength: 0, maxLength: 100 }),
  }),
  fc.record({
    type: fc.constant('getSecret' as const),
    key: fc.string({ minLength: 1, maxLength: 10 }),
  })
);

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('Property-Based: VaultController Invariants', () => {
  beforeEach(() => {
    resetMockVault();
    configureMockVault({ storedIdentities: [] });
  });

  afterEach(() => {
    resetMockVault();
  });

  /**
   * INVARIANT: After logout, authenticated state is always false
   * 
   * No matter what sequence of operations occurred before,
   * calling logout() must always result in isAuthenticated() === false
   */
  it('should always be unauthenticated after logout (property)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(actionArbitrary, { minLength: 1, maxLength: 20 }),
        async (actions) => {
          const vault = createMockVault({ storedIdentities: [] });
          
          // Execute random sequence of actions
          for (const action of actions) {
            try {
              switch (action.type) {
                case 'init':
                  await vault.init();
                  break;
                case 'register':
                  if (vault._state.initialized) {
                    await vault.register();
                  }
                  break;
                case 'login':
                  if (vault._state.initialized && vault._state.storedIdentities.length > 0) {
                    await vault.login(action.password);
                  }
                  break;
                case 'logout':
                  vault.lock();
                  break;
                case 'saveSecret':
                  if (vault._state.authenticated) {
                    await vault.saveSecret(action.key, action.value);
                  }
                  break;
                case 'getSecret':
                  if (vault._state.authenticated) {
                    await vault.getSecret(action.key);
                  }
                  break;
              }
            } catch {
              // Expected - some actions fail based on state
            }
          }
          
          // Final logout
          vault.lock();
          
          // INVARIANT: Must always be unauthenticated after logout
          expect(vault.isAuthenticated()).toBe(false);
          expect(vault._state.authenticated).toBe(false);
          expect(vault._state.did).toBeNull();
        }
      ),
      { numRuns: 100, verbose: true }
    );
  });

  /**
   * INVARIANT: Secrets are only accessible when authenticated
   * 
   * Any getSecret call when not authenticated should throw
   */
  it('should never expose secrets when unauthenticated (property)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(actionArbitrary, { minLength: 1, maxLength: 15 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        async (actions, testKey) => {
          const vault = createMockVault({ storedIdentities: [] });
          
          // Execute random sequence
          for (const action of actions) {
            try {
              switch (action.type) {
                case 'init':
                  await vault.init();
                  break;
                case 'register':
                  if (vault._state.initialized) await vault.register();
                  break;
                case 'login':
                  if (vault._state.initialized && vault._state.storedIdentities.length > 0) {
                    await vault.login(action.password);
                  }
                  break;
                case 'logout':
                  vault.lock();
                  break;
                case 'saveSecret':
                  if (vault._state.authenticated) {
                    await vault.saveSecret(action.key, action.value);
                  }
                  break;
              }   
            } catch {
              // Expected
            }
          }
          
          // If not authenticated, getSecret should throw
          if (!vault._state.authenticated) {
            await expect(vault.getSecret(testKey)).rejects.toThrow();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * INVARIANT: State consistency after concurrent-like operations
   * 
   * Rapid init/register/login/logout should not corrupt state
   */
  it('should maintain consistent state after rapid operations (property)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.oneof(
            fc.constant('init'),
            fc.constant('register'),
            fc.constant('login'),
            fc.constant('logout')
          ),
          { minLength: 5, maxLength: 30 }
        ),
        async (ops) => {
          const vault = createMockVault({ storedIdentities: [] });
          
          for (const op of ops) {
            try {
              switch (op) {
                case 'init':
                  await vault.init();
                  break;
                case 'register':
                  if (vault._state.initialized) await vault.register();
                  break;
                case 'login':
                  if (vault._state.initialized && vault._state.storedIdentities.length > 0) {
                    await vault.login('password');
                  }
                  break;
                case 'logout':
                  vault.lock();
                  break;
              }
            } catch {
              // Expected
            }
          }
          
          // State should always be internally consistent
          const state = vault._state;
          
          // If authenticated, must have a DID
          if (state.authenticated) {
            expect(state.did).not.toBeNull();
          }
          
          // If has DID, must be in storedIdentities
          if (state.did) {
            expect(state.storedIdentities).toContain(state.did);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * INVARIANT: Dispose always cleans up
   */
  it('should always cleanup on dispose regardless of prior state (property)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(actionArbitrary, { minLength: 0, maxLength: 10 }),
        async (actions) => {
          const vault = createMockVault({ storedIdentities: [] });
          
          // Execute random sequence
          for (const action of actions) {
            try {
              switch (action.type) {
                case 'init':
                  await vault.init();
                  break;
                case 'register':
                  if (vault._state.initialized) await vault.register();
                  break;
                case 'logout':
                  vault.lock();
                  break;
              }
            } catch {
              // Expected
            }
          }
          
          // Dispose
          vault.dispose();
          
          // INVARIANT: Must be fully cleaned up
          expect(vault._state.initialized).toBe(false);
          expect(vault._state.authenticated).toBe(false);
          expect(vault._state.did).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });
});
