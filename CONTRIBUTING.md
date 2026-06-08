# Contributing

Thanks for your interest in contributing to the Token Launchpad!

## Getting Started

1. Fork the repo
2. Ensure you meet the [prerequisites](./README.md#prerequisites)
3. Create a branch: `git checkout -b feature/your-feature`
4. Make your changes
5. Run tests and lint
6. Submit a pull request

## Development Setup

```bash
# Contract
cargo build --target wasm32v1-none --release
cargo test

# Frontend
cd frontend
npm install
npm run dev
```

## Code Style

- **Rust**: Follow `cargo fmt` and `cargo clippy` conventions
- **TypeScript/React**: Follow the existing patterns — no semicolons, 2-space indent, single quotes for JSX attributes
- No commented-out code — delete it
- No console.log in production code — use a proper logger

## Pull Request Checklist

- [ ] Contract tests pass (`cargo test`)
- [ ] Frontend builds clean (`cd frontend && npm run build`)
- [ ] No new warnings from Rust compiler or TypeScript
- [ ] If contract spec changed, regenerate TS bindings (see README)
- [ ] Update README if adding/changing features

## Contract Changes

If you modify the contract interface (function signatures, types, errors):

1. Update the contract code
2. Update tests
3. Rebuild WASM
4. Regenerate TypeScript bindings
5. Update the frontend contract client if needed

## Reporting Issues

Open a GitHub issue with:
- Brief description
- Steps to reproduce
- Expected vs actual behavior
- Environment (OS, Rust version, Node version, browser)
