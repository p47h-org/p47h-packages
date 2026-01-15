# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.10.2] - 2026-01-15

### Fixed

- **WasmCryptoAdapter**: Fixed default WASM path from `/wasm/p47h_vault_v{VERSION}.wasm` to `/wasm/p47h_wasm_core_bg.wasm` to match wasm-bindgen output
- **WasmCryptoAdapter**: Fixed JS glue path derivation (`_bg.wasm` → `.js` instead of `.wasm` → `.js`)

### Changed

- Improved error messages for WASM module loading failures
- Updated documentation for WASM loading process

### Testing

- **Mutation Testing**: Comprehensive Stryker mutation testing for VaultService
- **Unit Tests**: Enhanced test coverage for registration, login, and recovery flows
- **Edge Cases**: Added tests for error paths and input validation

## [0.10.1] - 2026-01-03

### Added

- Initial public release with stable API
- Argon2id + XChaCha20-Poly1305 + Ed25519 cryptographic primitives
- IndexedDB storage adapter
- Vite and Webpack plugin support
