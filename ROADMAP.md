# Vault — candidate features (parking lot)

> Deferred, **not** cancelled. Each item here is a CANDIDATE Vault feature that does
> **not** exist in the published packages today and that requires its own mini-milestone
> **with a prose design first** — not a packaging-window add. Listed so the public
> packaging stays honest (nothing here is claimed in present tense in any README, example
> or site) and so the work is recoverable later.
>
> Rule that put these here: what EXISTS is described in the present; what is COMING is a
> labelled roadmap. These are coming, not here.

## Verified-absent today (do NOT appear in copy/examples)

Confirmed against the code (`packages/vault-js/src`, `packages/vault-react/src`,
`IVault`) on 2026-06-06:

- **Local policy layer** — `policy.can()`, `policy.require()`: **do not exist** (no policy
  module anywhere in vault-js/vault-react). The Rust `core-policy` crate has a stateless
  evaluation engine, but it is **not** exposed through the JS SDK.
- **React `useP47HPolicy` / `can` / `require` hooks** — do not exist (no policy hook).
- **`verify()`** (signature verification) — does **not** exist at any layer of vault-js
  (only `sign()` exists; the WASM client exposes `sign_data`, no verify). Not in React.
- **`sign()` in React** — exists in `vault-js` (tested) but is **not** exposed by any
  React hook. Surfacing it in React is **new code**, decided separately.
- **`decisionReceipt`** — does not exist. See the design trap below.

## Candidate features (each needs its own mini-hito + prose design)

1. **Local policy layer for Vault (JS/React).** A small, honest local authorization
   surface over the existing Rust `core-policy` engine: e.g. `can(action, resource)` /
   `require(...)` in JS and a `useP47HPolicy` hook in React. Design must decide the exact
   public shape and what "local policy" means without a Trust Anchor (see #3). NOT the Pro
   distributed policy model — a strictly local, single-identity evaluation.

2. **`sign()` / `verify()` in React.** Expose the existing JS `sign()` (and a new
   `verify()` if/when it lands in `vault-js`) through React hooks. New code + new public
   contract → its own decision, not a packaging add.

3. **`decisionReceipt` — has a DESIGN TRAP, prose before code.** A signed local record of
   "this access decision was made". The trap: **what does it sign, and what do
   `policy_version` / `policy_hash` MEAN without a Trust Anchor?** In Pro, those coordinates
   are anchored by the TA-signed policy head; on a purely local Vault there is no TA, so a
   receipt's `policy_version`/`policy_hash` would be **self-asserted by the same key that
   made the decision** — it proves "I decided X against a policy whose hash is Y", not "an
   authority sanctioned policy Y". That distinction must be stated honestly in the receipt's
   semantics (and in any copy) or it becomes a credibility trap (a receipt that looks like
   distributed proof but is local self-attestation). Design the meaning in prose, decide
   what it legitimately claims, THEN build. Do not ship a receipt that overstates what a
   local-only signature proves.

## Pointers

- Pro distributed model (TA, signed policy distribution, claims, convergence, audit):
  `../p47h-pro/docs/policy-model-design.md` and `canonical-cable-status.md` (separate
  repo, `it4pyme/p47h-pro`). These candidate Vault features must NOT borrow Pro's
  distributed guarantees in their copy.
