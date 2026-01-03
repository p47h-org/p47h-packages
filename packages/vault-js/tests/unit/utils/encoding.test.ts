/**
 * @fileoverview Unit tests for encoding utilities
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { toBase64, fromBase64 } from '../../../src/utils/encoding';

describe('Encoding Utils', () => {
  describe('toBase64', () => {
    it('should encode empty array', () => {
      const result = toBase64(new Uint8Array([]));
      assert.strictEqual(result, '');
    });

    it('should encode simple bytes', () => {
      const result = toBase64(new Uint8Array([72, 101, 108, 108, 111])); // "Hello"
      assert.strictEqual(result, 'SGVsbG8=');
    });

    it('should encode binary data', () => {
      const result = toBase64(new Uint8Array([0x00, 0xFF, 0x7F, 0x80]));
      assert.strictEqual(result, 'AP9/gA==');
    });

    it('should handle large arrays', () => {
      const large = new Uint8Array(10000).fill(42);
      const encoded = toBase64(large);
      assert.ok(encoded.length > 0);
      // Verify round-trip
      const decoded = fromBase64(encoded);
      assert.deepStrictEqual(decoded, large);
    });
  });

  describe('fromBase64', () => {
    it('should decode empty string', () => {
      const result = fromBase64('');
      assert.deepStrictEqual(result, new Uint8Array([]));
    });

    it('should decode simple string', () => {
      const result = fromBase64('SGVsbG8='); // "Hello"
      assert.deepStrictEqual(result, new Uint8Array([72, 101, 108, 108, 111]));
    });

    it('should decode binary data', () => {
      const result = fromBase64('AP9/gA==');
      assert.deepStrictEqual(result, new Uint8Array([0x00, 0xFF, 0x7F, 0x80]));
    });

    it('should throw for invalid base64', () => {
      assert.throws(
        () => fromBase64('not valid base64!!!'),
        /Invalid character/
      );
    });
  });

  describe('round-trip', () => {
    it('should be reversible for ASCII', () => {
      const original = new TextEncoder().encode('Hello, World!');
      const encoded = toBase64(original);
      const decoded = fromBase64(encoded);
      assert.deepStrictEqual(decoded, original);
    });

    it('should be reversible for random bytes', () => {
      const original = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        original[i] = i;
      }
      const encoded = toBase64(original);
      const decoded = fromBase64(encoded);
      assert.deepStrictEqual(decoded, original);
    });

    it('should be reversible for cryptographic data', () => {
      // Simulate a 32-byte key
      const key = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        key[i] = Math.floor(Math.random() * 256);
      }
      const encoded = toBase64(key);
      const decoded = fromBase64(encoded);
      assert.deepStrictEqual(decoded, key);
    });
  });
});
