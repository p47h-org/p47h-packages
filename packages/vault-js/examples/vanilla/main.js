// P47H Vault — vanilla JavaScript example.
//
// Demonstrates the LOCAL-FIRST surface only: identity, encrypted secrets, and
// signing. Everything runs in the browser; nothing leaves the page. These are the
// real, stable @p47h/vault-js APIs — no policy/network layer is involved here.

import { P47hVault } from '@p47h/vault-js';

const log = (msg) => {
  const el = document.getElementById('log');
  el.textContent += `${msg}\n`;
  el.scrollTop = el.scrollHeight;
};

const vault = new P47hVault();

async function run() {
  // 1. Load the WASM crypto core (the @p47h/vault-js Vite plugin serves it).
  await vault.init();
  log('vault initialized (Rust/WASM core loaded)');

  const password = 'demo-password-please-change';

  // 2. Create OR unlock a local identity (an Ed25519 DID), encrypted at rest.
  const existing = await vault.getStoredIdentities();
  if (existing.length === 0) {
    const { did, recoveryCode } = await vault.register(password);
    log(`registered new identity: ${did}`);
    log(`SAVE THIS recovery code (only way to recover): ${recoveryCode}`);
  } else {
    const info = await vault.login(password);
    log(`unlocked identity: ${info.did}`);
  }

  // 3. The current DID (real API: getDid()).
  log(`current DID: ${vault.getDid()}`);

  // 4. Store and read back an encrypted secret (encrypted before it touches storage).
  await vault.saveSecret('api_key', 'sk_live_example_value');
  const secret = await vault.getSecret('api_key');
  log(`decrypted secret round-trip: ${secret}`);

  // 5. Sign a payload with the identity's private key (key never leaves WASM memory).
  const signature = await vault.sign(new TextEncoder().encode('transaction_payload'));
  log(`Ed25519 signature: ${signature.length} bytes`);

  // 6. Lock — wipes session keys and cached secrets from memory.
  vault.lock();
  log(`locked. authenticated? ${vault.isAuthenticated()}`);
}

run().catch((err) => log(`error: ${err.message}`));
