# Contributing to P47H Packages

Thank you for your interest in contributing to the P47H monorepo!

## Repository Structure

This is a monorepo containing:

- **`@p47h/vault-js`** - Core vault SDK with WASM cryptography
- **`@p47h/vault-react`** - React bindings and hooks

```
p47h-packages/
├── packages/
│   ├── vault-js/      # @p47h/vault-js
│   └── vault-react/   # @p47h/vault-react
├── package.json       # Workspace root
└── .github/           # CI/CD workflows
```

## License

This project is licensed under **Apache License 2.0**. This means:

- ✅ Your contributions are free to use commercially
- ✅ No copyleft restrictions
- ✅ Patent protection included

## How to Contribute

### Reporting Issues

- Check existing issues before creating a new one
- Use the issue templates provided
- Include reproduction steps for bugs
- For security vulnerabilities, please email <security@p47h.com> privately

### Pull Requests

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/your-feature`
3. **Make your changes**
4. **Write or update tests**
5. **Ensure all tests pass**: `npm test`
6. **Commit with descriptive messages**
7. **Push and create a Pull Request**

### Code Style

- Follow the existing code style
- Run `npm run lint` before committing
- Add JSDoc comments for public APIs
- Write tests for new functionality

### Header Format

Please include this header in new source files:

```typescript
// Copyright (c) 2025 P47H.
// Licensed under the Apache License, Version 2.0.
```

### Testing

```bash
# Run all tests (all packages)
npm test

# Run tests for a specific package
npm test --workspace=@p47h/vault-js
npm test --workspace=@p47h/vault-react

# Type checking
npm run typecheck
```

## Development Setup

```bash
# Clone the repository
git clone https://github.com/p47h-org/p47h-packages.git
cd p47h-packages

# Install dependencies (all workspaces)
npm install

# Build all packages
npm run build

# Run specific package commands
npm run build --workspace=@p47h/vault-js
npm run test --workspace=@p47h/vault-react
```

## Questions?

- Open a [Discussion](https://github.com/p47h-org/p47h-packages/discussions)
- Email: <support@p47h.com>

---

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
