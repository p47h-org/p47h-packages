# There is no account recovery

**`@p47h/vault-js` has no password recovery, no recovery code, and no reset.
If the password is lost, the data in that vault is unrecoverable — by you, by
us, by anyone.**

This page exists because that is a real limitation, it is load-bearing for
anyone building on this SDK, and it used to be papered over.

---

## What changed, and why

Versions up to `0.10.x` returned a `recoveryCode` from `register()` and exposed
`recoverAccount()`. **That mechanism did not work, and using it destroyed the
vault.**

The reason is structural. The Ed25519 identity is wrapped with a key derived
from the active password:

```
password ──KDF──> sessionKey ──wrap──> identity
```

Recovery decrypted the outer container with the recovery code and re-encrypted
it under the new password. But the wrapped identity *inside* stayed bound to a
key derived from the **old** password, and nothing in the recovery path could
re-derive it. The result:

| After running recovery | Outcome |
| --- | --- |
| Login with the new password | Outer container opens, then **fails to restore the identity** |
| Login with the old password | **Fails to decrypt** — the container was rewritten |
| The old recovery code | Invalidated if rotation was requested |

Both doors locked. The state was written to storage *before* anything verified
it could be opened again, so the failure was silent and permanent.

We removed it rather than leave a safety net that does not hold weight. A
recovery feature that destroys vaults is worse than no recovery feature, because
users rely on it precisely when they have no other copy.

---

## What we did NOT do

We did not "fix the ordering". Validating before persisting would have turned
silent data loss into a clean error — an improvement, but recovery still would
not work. The defect is the key hierarchy, not the sequence of steps.

---

## What proper recovery would require

A two-tier envelope, so that the identity is never bound directly to a password:

```
identity ──wrap──> DEK              (DEK is random, not derived from anything)
DEK      ──wrap──> KEK_password     (KDF(password,      salt_p))
DEK      ──wrap──> KEK_recovery     (KDF(recovery_code, salt_r))
```

Changing the password then re-wraps only the DEK. Any number of independent
unlock paths can be added — recovery code, hardware key, escrow — without ever
touching the identity.

This is a vault format change and is **not currently planned**. See "If you need
recovery" below.

---

## What this means for you

**`@p47h/vault-js` is a reference implementation of the P47H core for the web.**
It is meant to be good and safe at what it does, not to reach feature parity
with a password manager. Recovery is exactly the kind of feature a product needs
and a reference implementation does not.

Concretely:

- `register(password)` returns `{ did }`. There is no second value to store.
- There is no `recoverAccount()`, no `recover()` in `@p47h/vault-react`.
- Stored vaults are `version: 2` and contain **one** encrypted copy. Earlier
  vaults carried a second copy encrypted under the recovery code; that copy was
  a second offline-attack oracle for the same data, and it is no longer written.

### If you are building on this SDK

Make the absence explicit in your own UI. Users assume recovery exists because
every consumer product has it. At minimum:

- Say so at the moment the password is chosen, not in a help page.
- Offer your own backup path if your product needs one — export the vault, or
  keep a second identity. The SDK does not stop you from building that on top.

### Existing vaults created with `0.10.x` or earlier

They keep working. Their `recoveryBlob` field is ignored and is no longer
updated. **Any recovery code issued by an earlier version is void** — it was
never able to restore access, so nothing is lost by discarding it. Tell your
users to stop relying on it.

If a user already ran recovery on an older version, their vault opens only if
they still know the original password.

---

## If you need recovery

Open an issue describing the use case. If real projects need it, the two-tier
envelope above is the design to implement — properly, with a round-trip test
proving `register(P1) → recover(code, P2) → login(P2)` actually works, against
the real WASM core and not a mock.

The test harness for that already exists in `tests/mocks/MockCryptoPort.ts`,
which now binds every operation to the key material it is supposed to be bound
to. The original bug shipped despite green tests and mutation testing because
the mock returned a valid identity regardless of the session key it was given.
That will not happen again silently.
