# P47H Vault JS

Local-first encrypted vault for browser applications.
Client-side key derivation, encryption, and signing via Rust/WASM.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-green.svg)](./LICENSE)
[![npm version](https://img.shields.io/npm/v/@p47h/vault-js)](https://www.npmjs.com/package/@p47h/vault-js)

## Overview

P47H Vault JS addresses the insecurity of storing sensitive user secrets (API keys, private keys, PII) in browser storage mechanisms like `localStorage` or cookies.

It provides an encrypted enclave within the client application, leveraging the P47H Core Rust implementation compiled to WebAssembly. This ensures that cryptographic operations are consistent across platforms and resistant to common JavaScript-based attack vectors.

P47H Vault JS is designed for applications that require strong client-side guarantees.
It is not a password manager, nor a replacement for server-side HSMs.

## Key Features

* **WASM-Backed Cryptography:** Core logic resides in a compiled Rust binary, not interpreted JavaScript.
* **Memory Isolation:** Private keys are generated and used inside WASM linear memory and are never exposed to the JavaScript heap in plaintext.
* **Authenticated Encryption:** Data is persisted using XChaCha20Poly1305.
* **Key Derivation:** Master keys are derived using Argon2id (OWASP recommendation) to resist brute-force attacks.
* **Framework Agnostic:** Pure TypeScript implementation suitable for React, Vue, Angular, or vanilla JS.
* **Apache 2.0 License:** Free for commercial and private use. No copyleft restrictions.

## When should I use this?

Use P47H Vault JS if you need to:

* Store API keys, tokens, or credentials in the browser
* Encrypt user data before it reaches your backend
* Generate and use cryptographic identities client-side
* Reduce compliance risk (GDPR, SOC2) by minimizing server-side exposure

Do not use this library if your threat model requires server-side key custody.

## Architecture

This library adheres to Clean Architecture principles. It exposes a strict interface (`IVault`) and allows for dependency injection of storage adapters, ensuring testability and modularity.

## Installation

```bash
npm install @p47h/vault-js
```

## Usage

### Initialization

The library loads the WASM module asynchronously:

```typescript
import { P47hVault } from '@p47h/vault-js';

const vault = new P47hVault();
await vault.init({ wasmPath: '/wasm/p47h_vault_v0.1.0.wasm' });

// Console will show: "� P47H Vault v0.1.0 initialized"
```

### Identity Creation

Generates a new Ed25519 identity. The private key is encrypted immediately upon generation using a session key derived from the provided password.

```typescript
try {
  const { did, recoveryCode } = await vault.register("strong-user-password");
  console.log("Identity created:", did); // e.g., did:p47h:123...
  console.log("⚠️ Save this recovery code:", recoveryCode);
} catch (error) {
  console.error("Registration failed:", error);
}
```

### Secure Storage

Store arbitrary secrets. The payload is encrypted before touching the persistent storage layer.

```typescript
await vault.saveSecret("stripe_api_key", "sk_live_...");
```

### Zero-Exposure Usage

Use stored secrets without extracting them to the application layer. The vault handles decryption and usage internally.

```typescript
// Example: Signing a payload with the identity's private key
const signature = await vault.sign(new TextEncoder().encode("transaction_payload"));
```

## License

**Apache License 2.0** — Free for commercial and private use.

You can:

* ✅ Use in commercial applications
* ✅ Modify and distribute
* ✅ Use in proprietary software
* ✅ Use without attribution in UI (attribution in source only)

No copyleft restrictions. No viral licensing requirements.

## API Reference

### VaultConfig

```typescript
interface VaultConfig {
  wasmPath?: string;      // Path to WASM binary (default: auto-detect)
  storage?: IStorage;     // Custom storage adapter (default: IndexedDB)
}
```

### Core Methods

```typescript
// Create new identity with recovery code
vault.register(password: string): Promise<{did: string, recoveryCode: string}>;

// Unlock existing identity
vault.login(password: string): Promise<IdentityInfo>;

// Store encrypted secret
vault.saveSecret(key: string, value: string): Promise<void>;

// Retrieve decrypted secret
vault.getSecret(key: string): Promise<string | null>;

// Sign data with identity's private key
vault.sign(data: Uint8Array): Promise<Uint8Array>;

// Lock vault and clear memory
vault.lock(): void;
```

---

Copyright © 2025 P47H. Licensed under Apache 2.0.
