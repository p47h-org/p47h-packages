# P47H Vault — vanilla JavaScript example

A minimal, framework-free example of the **local-first** Vault surface: create an
identity, store and read an encrypted secret, and sign a payload — all in the browser.

It uses only the stable `@p47h/vault-js` APIs:
`init`, `register` / `login`, `getStoredIdentities`, `getDid`, `saveSecret` /
`getSecret`, `sign`, `lock`, `isAuthenticated`. No network and no policy layer are
involved — this is the encrypted-local-storage core.

## Run

```bash
npm install
npm run dev
```

Open the printed URL. The flow in [`main.js`](./main.js) runs once and logs each step.

The Rust/WASM crypto core is served by the official
[`p47hVaultPlugin`](../../plugins/vite.ts) (`@p47h/vault-js/plugins/vite`) configured
in [`vite.config.js`](./vite.config.js) — no manual WASM copying.

> First run calls `register()` and prints a **recovery code** — in a real app, show it
> to the user once and have them store it offline. It is the only way to recover the
> vault if the password is lost.
