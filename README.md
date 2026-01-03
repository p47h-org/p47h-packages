# P47H Packages

**Monorepo for P47H client-side encrypted storage SDKs.**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-green.svg)](./LICENSE)
[![npm @p47h/vault-js](https://img.shields.io/npm/v/@p47h/vault-js)](https://www.npmjs.com/package/@p47h/vault-js)
[![npm @p47h/vault-react](https://img.shields.io/npm/v/@p47h/vault-react)](https://www.npmjs.com/package/@p47h/vault-react)

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| [`@p47h/vault-js`](./packages/vault-js) | Core JavaScript SDK. WASM-backed encryption with VaultService API. | [![npm](https://img.shields.io/npm/v/@p47h/vault-js)](https://www.npmjs.com/package/@p47h/vault-js) |
| [`@p47h/vault-react`](./packages/vault-react) | React bindings. Hooks for identity and secret management. | [![npm](https://img.shields.io/npm/v/@p47h/vault-react)](https://www.npmjs.com/package/@p47h/vault-react) |

## Why P47H?

Browser storage is fundamentally insecure:

* `localStorage` is readable by any injected script
* Cookies are transmitted over the network
* WebCrypto APIs are easy to misuse
* DIY crypto fails audits

P47H moves encryption where it belongs: inside a WebAssembly sandbox, compiled from audited Rust.

## Quick Start

### Vanilla JavaScript

```bash
npm install @p47h/vault-js
```

```typescript
import { VaultService } from "@p47h/vault-js";

const vault = new VaultService();
await vault.init();

const { recoveryCode } = await vault.register("user-password");
console.log("⚠️ Save this:", recoveryCode);

await vault.saveSecret("api_key", "sk-live-12345");
const key = await vault.getSecret("api_key");
```

### React

```bash
npm install @p47h/vault-react
```

```tsx
import { P47hProvider, useSecret } from '@p47h/vault-react';

function App() {
  return (
    <P47hProvider>
      <SecureNote />
    </P47hProvider>
  );
}

function SecureNote() {
  const { value, set } = useSecret('my_note');
  return <textarea value={value ?? ''} onChange={e => set(e.target.value)} />;
}
```

## Cryptography

All packages share the same Rust/WASM core:

| Primitive | Algorithm |
|-----------|-----------|
| Key Derivation | Argon2id (OWASP recommended) |
| Encryption | XChaCha20-Poly1305 |
| Signatures | Ed25519 |
| Memory | Zeroized on drop |

Private keys never touch the JavaScript heap.

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm run test

# Lint
npm run lint

# Type check
npm run typecheck
```

### Package Dependencies

```
@p47h/vault-react
       └── @p47h/vault-js
                └── WASM (p47h-open-core)
```

## License

**Apache License 2.0** — Free for commercial and private use.

* ✅ Commercial applications
* ✅ Closed-source projects
* ✅ Modification and distribution
* ✅ No copyleft restrictions

No telemetry. No phone home. Works fully offline.

## Related

* **[p47h-open-core](https://github.com/p47h-org/p47h-open-core)** — Rust cryptographic core
* **[p47h.com](https://p47h.com)** — Documentation and demos

---

Copyright © 2025 P47H. Licensed under Apache 2.0.
