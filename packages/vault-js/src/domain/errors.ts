/**
* Domain error definitions for P47H Vault JS.
* Basis for handling typed exceptions.
 */

export class VaultError extends Error {
  constructor(message: string, public code: string, public cause?: unknown) {
    super(message);
    this.name = 'VaultError';
  }
}

export class InitializationError extends VaultError {
  constructor(message: string, cause?: unknown) {
    super(message, 'VAULT_INIT_ERROR', cause);
    this.name = 'InitializationError';
  }
}

export class AuthenticationError extends VaultError {
  constructor(message = 'Invalid password or corrupted vault') {
    super(message, 'AUTH_FAILED');
    this.name = 'AuthenticationError';
  }
}

export class NotAuthenticatedError extends VaultError {
  constructor() {
    super('Vault is locked. Unlock it first.', 'VAULT_LOCKED');
    this.name = 'NotAuthenticatedError';
  }
}

export class StorageError extends VaultError {
  constructor(message: string, cause?: unknown) {
    super(message, 'STORAGE_ERROR', cause);
    this.name = 'StorageError';
  }
}

export class CryptoError extends VaultError {
  constructor(message: string, cause?: unknown) {
    super(message, 'CRYPTO_ERROR', cause);
    this.name = 'CryptoError';
  }
}