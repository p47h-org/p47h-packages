# Security Policy

## Supported Versions

| Package | Version | Supported |
| ------- | ------- | --------- |
| @p47h/vault-js | 0.10.x | ✅ |
| @p47h/vault-js | < 0.10 | ❌ |
| @p47h/vault-react | 0.10.x | ✅ |
| @p47h/vault-react | < 0.10 | ❌ |

## Reporting a Vulnerability

The P47H team takes security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please email us at: **<security@p47h.com>**

Include the following information:

- Type of vulnerability
- Affected package(s): `@p47h/vault-js`, `@p47h/vault-react`, or both
- Location of the affected source code (file path, line numbers)
- Step-by-step instructions to reproduce
- Proof of concept or exploit code (if available)
- Potential impact of the vulnerability

### What to Expect

- **Acknowledgment**: We will acknowledge receipt within 48 hours
- **Assessment**: We will assess the vulnerability within 7 days
- **Remediation**: Critical vulnerabilities will be patched within 30 days
- **Credit**: We will credit reporters in our security advisories (unless you prefer anonymity)

### Scope

The following are in scope:

- JavaScript SDK source code (`packages/vault-js`)
- React bindings (`packages/vault-react`)
- WASM wrapper code
- Key derivation logic
- Secret encryption/decryption

The following are out of scope:

- Demo web application bugs (report to vault-web repo)
- Third-party dependencies (report to respective maintainers)

## Security Best Practices

When using P47H Vault packages:

1. **Always call `lock()`** when the user logs out or app is backgrounded
2. **Never store passwords** in localStorage or sessionStorage
3. **Use HTTPS only** in production
4. **Save recovery codes** - they cannot be recovered if lost
5. **Keep packages updated** to receive security patches

---

Thank you for helping keep P47H and our users safe!
