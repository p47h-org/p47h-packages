/**
 * @fileoverview Application Layer Index
 * 
 * Re-exports all use cases and services.
 * 
 * @module application
 * @license Apache-2.0
 */

// Use Cases
export { RegisterIdentityUseCase } from './use-cases/RegisterIdentityUseCase';
export type { RegisterInput } from './use-cases/RegisterIdentityUseCase';

export { LoginUseCase } from './use-cases/LoginUseCase';
export type { LoginInput } from './use-cases/LoginUseCase';

export { RecoverAccountUseCase } from './use-cases/RecoverAccountUseCase';

export { SecretManagementUseCase } from './use-cases/SecretManagementUseCase';

// Services
export { SessionManager } from './services/SessionManager';
export type { SessionState } from './services/SessionManager';

// Ports
export type { ICryptoPort, ICryptoClient } from './ports/ICryptoPort';

// Internal Types
export type { VaultInternalData } from './types';
export { RECOVERY_CODE_PREFIX, RECOVERY_CODE_BYTES } from './types';
