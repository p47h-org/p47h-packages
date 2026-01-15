# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.10.2] - 2026-01-15

### Fixed

- **ESM Exports**: Fixed `package.json` exports - `import` now points to `./dist/index.js` (was `./dist/index.mjs`)
- **CJS Exports**: Fixed `main` field - now points to `./dist/index.cjs` (was `./dist/index.js`)
- Package now correctly resolves in Vite, Next.js, and other ESM-first bundlers

### Changed

- Updated dependency on `@p47h/vault-js` to `0.10.2`

### Testing

- **Unit Tests**: Added tests for `useIdentity` and `useSecret` hooks
- **React Testing Library**: Component integration tests
- **Fast-check**: Property-based testing for hook state transitions

## [0.10.1] - 2026-01-03

### Added

- Initial public release
- `P47hProvider` component for React context
- `useIdentity` hook for authentication management
- `useSecret` hook for encrypted persistent state
- Strict Mode and SSR compatibility
