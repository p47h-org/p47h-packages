/**
 * @fileoverview Encoding utilities for Base64 conversion
 * 
 * Pure functions for encoding/decoding binary data.
 * 
 * @module utils/encoding
 * @license Apache-2.0
 */

/**
 * Converts a Uint8Array to a Base64 string.
 * 
 * @param bytes - The binary data to encode
 * @returns Base64 encoded string
 */
export function toBase64(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (x) => String.fromCharCode(x)).join('');
  return btoa(binString);
}

/**
 * Converts a Base64 string to a Uint8Array.
 * 
 * @param base64 - The Base64 encoded string
 * @returns Decoded binary data
 * @throws {Error} If the input is not valid Base64
 */
export function fromBase64(base64: string): Uint8Array {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.codePointAt(0)!);
}
