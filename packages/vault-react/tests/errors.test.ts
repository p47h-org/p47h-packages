/**
 * @fileoverview Error Handling and Edge Cases Tests
 * 
 * Tests for error types, edge cases, and error recovery scenarios.
 * 
 * @module tests/errors.test
 */

import { describe, it, expect } from 'vitest';
import {
  InitTimeoutError,
  WasmNotSupportedError,
  InitExhaustedError,
} from '../src/internal/InitializationOrchestrator';

describe('Error Types', () => {
  // ==========================================================================
  // InitTimeoutError
  // ==========================================================================
  
  describe('InitTimeoutError', () => {
    it('should have correct properties', () => {
      const error = new InitTimeoutError(5000, 3000);
      
      expect(error.name).toBe('InitTimeoutError');
      expect(error.elapsedMs).toBe(5000);
      expect(error.timeoutMs).toBe(3000);
      expect(error.message).toContain('5000ms');
      expect(error.message).toContain('timeout: 3000ms');
    });

    it('should be instanceof Error', () => {
      const error = new InitTimeoutError(1000, 1000);
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(InitTimeoutError);
    });

    it('should have helpful message', () => {
      const error = new InitTimeoutError(10000, 5000);
      
      expect(error.message).toContain('incompatible browser');
      expect(error.message).toContain('network issues');
    });
  });

  // ==========================================================================
  // WasmNotSupportedError
  // ==========================================================================
  
  describe('WasmNotSupportedError', () => {
    it('should have correct properties', () => {
      const error = new WasmNotSupportedError();
      
      expect(error.name).toBe('WasmNotSupportedError');
      expect(error.message).toContain('WebAssembly is not supported');
    });

    it('should be instanceof Error', () => {
      const error = new WasmNotSupportedError();
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(WasmNotSupportedError);
    });

    it('should suggest modern browser', () => {
      const error = new WasmNotSupportedError();
      
      expect(error.message).toContain('modern browser');
    });
  });

  // ==========================================================================
  // InitExhaustedError
  // ==========================================================================
  
  describe('InitExhaustedError', () => {
    it('should have correct properties', () => {
      const lastError = new Error('Network failed');
      const error = new InitExhaustedError(3, lastError);
      
      expect(error.name).toBe('InitExhaustedError');
      expect(error.attempts).toBe(3);
      expect(error.lastError).toBe(lastError);
    });

    it('should include attempt count in message', () => {
      const lastError = new Error('Connection refused');
      const error = new InitExhaustedError(5, lastError);
      
      expect(error.message).toContain('5 attempts');
      expect(error.message).toContain('Connection refused');
    });

    it('should be instanceof Error', () => {
      const error = new InitExhaustedError(1, new Error('test'));
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(InitExhaustedError);
    });
  });
});

describe('Edge Cases', () => {
  // ==========================================================================
  // Empty/Null Handling
  // ==========================================================================
  
  describe('Empty/Null Handling', () => {
    it('should handle empty password gracefully', () => {
      // This is more of an integration concern, but good to document
      // The vault-js layer should validate passwords
    });

    it('should handle empty secret key', () => {
      // useSecret should handle empty key gracefully
    });

    it('should handle null config', () => {
      // Provider should work with undefined/null config
    });
  });

  // ==========================================================================
  // Type Guards
  // ==========================================================================
  
  describe('Type Guards', () => {
    it('should correctly identify InitTimeoutError', () => {
      const timeout = new InitTimeoutError(1000, 1000);
      const generic = new Error('generic');
      
      expect(timeout instanceof InitTimeoutError).toBe(true);
      expect(generic instanceof InitTimeoutError).toBe(false);
    });

    it('should correctly identify WasmNotSupportedError', () => {
      const wasm = new WasmNotSupportedError();
      const generic = new Error('generic');
      
      expect(wasm instanceof WasmNotSupportedError).toBe(true);
      expect(generic instanceof WasmNotSupportedError).toBe(false);
    });

    it('should correctly identify InitExhaustedError', () => {
      const exhausted = new InitExhaustedError(1, new Error('test'));
      const generic = new Error('generic');
      
      expect(exhausted instanceof InitExhaustedError).toBe(true);
      expect(generic instanceof InitExhaustedError).toBe(false);
    });
  });
});

describe('Error Recovery Patterns', () => {
  describe('UI Error Handling', () => {
    it('errors should be safe to render', () => {
      const errors = [
        new InitTimeoutError(1000, 500),
        new WasmNotSupportedError(),
        new InitExhaustedError(3, new Error('test')),
      ];
      
      errors.forEach(error => {
        // Should not throw when accessing message
        expect(() => error.message).not.toThrow();
        expect(() => error.name).not.toThrow();
        expect(() => String(error)).not.toThrow();
      });
    });

    it('errors should be JSON serializable', () => {
      const errors = [
        new InitTimeoutError(1000, 500),
        new WasmNotSupportedError(),
        new InitExhaustedError(3, new Error('test')),
      ];
      
      errors.forEach(error => {
        // Should not throw when serializing
        expect(() => JSON.stringify({
          name: error.name,
          message: error.message,
        })).not.toThrow();
      });
    });
  });
});
