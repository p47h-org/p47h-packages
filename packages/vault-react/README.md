# @p47h/vault-react

**Encrypted persistent state for React applications.**
Secure secrets locally. No backend. No WebCrypto. No leaks.

---

## Why?

Storing secrets in the browser is broken.

* `localStorage` is readable by any injected script
* Cookies are sent over the network
* Environment variables leak at build time
* WebCrypto APIs are easy to misuse

**P47H Vault React** gives you a secure, local-first vault backed by WebAssembly and modern cryptography — exposed as simple React hooks.

You think in **state**.
We handle **encryption**.

---

## What is it?

`@p47h/vault-react` is a React integration for **P47H Vault**, a browser-side encrypted storage powered by a Rust core compiled to WebAssembly.

It lets you store and use secrets (API keys, private data, notes, tokens) **without ever exposing them in plaintext to the JavaScript heap**.

No server required. Works offline.

---

## Features

* **End-to-end local encryption** (Argon2id + XChaCha20-Poly1305)
* **WASM-backed core** (Rust, not JavaScript crypto)
* **React-first DX** (Context + hooks)
* **Zero configuration** (no WASM plumbing)
* **Memory hygiene** (keys zeroized on lock)
* **Framework friendly** (React, Next.js, Vite)
* **Strict Mode compatible** (no double-mount issues)
* **Race condition proof** (stale request handling)

---

## Installation

```bash
npm install @p47h/vault-react
```

---

## Quick Start

### 1. Wrap your app

```tsx
import { P47hProvider } from '@p47h/vault-react';

export default function App() {
  return (
    <P47hProvider fallback={<div>Loading vault…</div>}>
      <MyApp />
    </P47hProvider>
  );
}
```

That's it.
No WASM config. No async bootstrapping. No globals.

---

### 2. Manage identity

```tsx
import { useIdentity } from '@p47h/vault-react';

function Login() {
  const { register, login, logout, isAuthenticated, isLoading } = useIdentity();

  if (isAuthenticated) {
    return <button onClick={logout}>Lock vault</button>;
  }

  return (
    <button onClick={() => login('user-password')}>
      Unlock vault
    </button>
  );
}
```

---

### 3. Store secrets (the magic part)

```tsx
import { useSecret } from '@p47h/vault-react';

function SecretNote() {
  const { value, set, status, locked } = useSecret('my_private_note');

  if (locked) return <div>Vault locked</div>;
  if (status === 'loading') return <div>Decrypting…</div>;

  return (
    <textarea
      value={value ?? ''}
      onChange={e => set(e.target.value)}
      placeholder="This text is encrypted locally"
    />
  );
}
```

That's it.

You are now storing encrypted data in the browser
**without touching cryptography.**

---

## Mental Model

Think of `useSecret()` as:

> `useState()` — but encrypted and persisted securely.

| React        | P47H          |
| ------------ | ------------- |
| `useState()` | `useSecret()` |
| Plaintext    | Encrypted     |
| JS memory    | WASM memory   |
| Unsafe       | Hardened      |

---

## API Overview

### `<P47hProvider />`

```tsx
<P47hProvider
  config={optionalConfig}
  fallback={<Loading />}
  errorFallback={(error) => <ErrorPage error={error} />}
/>
```

Handles:

* WASM loading
* Vault lifecycle
* Global error handling
* React Strict Mode compatibility

---

### `useIdentity()`

```ts
const {
  did,
  isAuthenticated,
  login,
  register,
  logout,
  recover,
  isLoading,
  error,
  storedIdentities
} = useIdentity();
```

Manages:

* Vault unlock / lock
* Identity lifecycle
* Recovery code generation
* Multiple identity support

---

### `useSecret(key)`

```ts
const {
  value,      // string | null - The decrypted value
  set,        // (v: string) => void - Save (auto-encrypts)
  status,     // 'idle' | 'loading' | 'saving' | 'error'
  exists,     // boolean - true if value !== null
  locked,     // boolean - true if !identity
  error       // Error | null
} = useSecret('secret_key');
```

States:

* `locked` → vault not unlocked (show lock UI)
* `status === 'loading'` → decrypting in progress
* `status === 'saving'` → encrypting/persisting
* `exists` → secret exists vs empty placeholder

---

## Advanced Usage

### Registration with Recovery Code

```tsx
function RegisterForm() {
  const { register } = useIdentity();
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  const handleRegister = async (password: string) => {
    const result = await register(password);
    setRecoveryCode(result.recoveryCode);
    // ⚠️ IMPORTANT: Show this to the user!
  };

  if (recoveryCode) {
    return (
      <div className="recovery-warning">
        <h2>⚠️ Save your Recovery Code!</h2>
        <code>{recoveryCode}</code>
        <p>
          This is the ONLY way to recover your vault 
          if you forget your password.
        </p>
      </div>
    );
  }

  // ... registration form
}
```

### Multiple Secrets

```tsx
function SettingsPanel() {
  const apiKey = useSecret('api_key');
  const privateNote = useSecret('private_note');
  const encryptedToken = useSecret('auth_token');

  // Each secret is independent and cached
  return (
    <div>
      <input value={apiKey.value ?? ''} onChange={e => apiKey.set(e.target.value)} />
      <textarea value={privateNote.value ?? ''} onChange={e => privateNote.set(e.target.value)} />
      {/* ... */}
    </div>
  );
}
```

### Status-based UI

```tsx
function SecretInput({ secretKey }: { secretKey: string }) {
  const { value, set, status, exists, error } = useSecret(secretKey);

  return (
    <div className="secret-input">
      <input
        type="password"
        value={value ?? ''}
        onChange={(e) => set(e.target.value)}
        placeholder={exists ? '••••••••' : 'Enter value'}
        disabled={status === 'loading'}
      />
      
      <div className="status">
        {status === 'loading' && <Spinner />}
        {status === 'saving' && <span>💾 Saving...</span>}
        {status === 'idle' && exists && <span>✅ Saved</span>}
        {status === 'error' && <span>❌ {error?.message}</span>}
      </div>
    </div>
  );
}
```

---

## Security Model (Short Version)

* Keys are derived using **Argon2id**
* Secrets are encrypted with **XChaCha20-Poly1305**
* Private keys live inside **WASM linear memory**
* Secrets are never stored or transmitted in plaintext
* Memory is wiped on vault lock

This is **not** WebCrypto wrappers.
This is a compiled Rust core.

---

## Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                    Your React App                       │
├─────────────────────────────────────────────────────────┤
│  useSecret()    useIdentity()    useP47h()              │
├─────────────────────────────────────────────────────────┤
│                   P47hProvider                          │
│              (Context + State Management)               │
├─────────────────────────────────────────────────────────┤
│                  VaultController                        │
│         (Internal - Strict Mode + SSR safe)             │
├─────────────────────────────────────────────────────────┤
│                  @p47h/vault-js                         │
│                   (VaultService)                        │
├─────────────────────────────────────────────────────────┤
│                    WASM Module                          │
│          (Rust - Argon2id + XChaCha20)                  │
└─────────────────────────────────────────────────────────┘
```

---

## When should I use this?

Use `@p47h/vault-react` if you need to:

* Store API keys in frontend apps
* Handle sensitive user data locally
* Build offline-first or privacy-first apps
* Avoid backend secret storage
* Reduce GDPR exposure

Do **not** use it if:

* You need shared secrets across users
* You want server-side access to the data

---

## TypeScript Support

Full TypeScript support with strict types:

```typescript
import type { 
  UseSecretReturn, 
  UseIdentityReturn,
  VaultState,
  SecretStatus 
} from '@p47h/vault-react';

// All hooks are fully typed
const secret: UseSecretReturn = useSecret('key');
const identity: UseIdentityReturn = useIdentity();
```

---

## License

**Apache License 2.0**

* ✔ Commercial use allowed
* ✔ Closed-source apps allowed
* ✔ No telemetry
* ✔ No phone home

You control your data. Always.

---

## Related

* Core engine: `p47h-open-core` (Rust / WASM)
* JS SDK: `@p47h/vault-js`
* Website: [https://p47h.com](https://p47h.com)

---

## Final note

This library exists because existing tools were not secure enough.

We built it for production use first.
Then we open-sourced it.
