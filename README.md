# Token Launchpad

A **token launchpad** smart contract on Soroban (Stellar) with a full React frontend. Users contribute deposit tokens (e.g. USDC) during a sale window to receive project tokens with optional cliff + linear vesting.

## Features

- **Configurable sale**: price, hard cap, soft cap, start/end timestamps
- **Vesting**: cliff period (post-sale) + linear release over configured duration
- **Admin controls**: fund the pool, withdraw deposits (after soft cap met), cancel (emergency stop)
- **Investor protections**: refunds if cancelled or soft cap not reached
- **Full frontend**: React + TypeScript + Tailwind CSS v4, Freighter wallet integration
- **Deployment scripts**: install WASM, deploy, initialize, manage from CLI

## Architecture

```
token_launchpad/
├── contracts/
│   └── token_launchpad/    # Soroban smart contract (Rust)
│       ├── src/lib.rs      # Contract logic
│       └── src/test.rs     # 9 unit tests
├── frontend/               # React SPA (Vite + TS + Tailwind)
│   └── src/
│       ├── components/     # WalletBar, AdminPanel, ContributePanel
│       ├── hooks/          # useWallet, useLaunchpad
│       ├── lib/stellar.ts  # Contract client helpers
│       └── contract/       # TypeScript bindings (built from WASM spec)
└── scripts/
    └── manage.mjs          # CLI deploy/management tool
```

### Contract Functions

| Function              | Auth     | Description                                  |
|-----------------------|----------|----------------------------------------------|
| `initialize`          | admin    | Configure sale parameters                    |
| `contribute`          | caller   | Send deposit tokens, receive allocation      |
| `claim`               | caller   | Withdraw vested tokens                       |
| `fund`                | admin    | Deposit sale tokens into the pool             |
| `withdraw_deposits`   | admin    | Collect deposit tokens after sale ends       |
| `cancel`              | admin    | Emergency stop                               |
| `refund`              | caller   | Get deposit back if cancelled/below soft cap |
| `get_launchpad_info`  | —        | Read sale state                              |
| `get_contributor_info`| —        | Read individual contribution                 |
| `get_claimable`       | —        | Read vested & available amounts              |

## Prerequisites

- **Rust** ≥ 1.79 + `wasm32-unknown-unknown` target:
  ```bash
  rustup target add wasm32-unknown-unknown
  ```
- **Soroban CLI** (for deployment):
  ```bash
  cargo install soroban-cli --features opt
  ```
- **Node.js** ≥ 20 + npm
- **Freighter** browser extension (for frontend wallet interaction)

## Quick Start

### 1. Build & Test the Contract

```bash
cargo build --target wasm32-unknown-unknown --release
cargo test
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env      # edit VITE_CONTRACT_ID after deploying
npm install
npm run dev               # http://localhost:5173
```

### 3. Deploy (testnet)

```bash
export SOURCE=<your-secret-key-or-identity-name>
./scripts/manage.sh deploy
./scripts/manage.sh info   # verify it's deployed
```

Then initialize with your token addresses:

```bash
./scripts/manage.sh initialize \
  <admin-address> \
  <token-address> \
  <deposit-token-address> \
  <price> <cap> <soft-cap> <start-ts> <end-ts> [cliff] [vesting-duration]
```

## Regenerating TypeScript Bindings

If the contract spec changes, regenerate the frontend bindings:

```bash
# Build WASM first
cargo build --target wasm32-unknown-unknown --release

# Generate bindings
stellar contract bindings typescript \
  --wasm contracts/token_launchpad/target/wasm32-unknown-unknown/release/token_launchpad.wasm \
  --output-dir frontend/src/contract \
  --contract-id <deployed-contract-id>
```

**Important**: The generated `src/index.ts` uses `enum` which is incompatible with TypeScript 6.0's `erasableSyntaxOnly`. After regeneration, convert the `enum` to a `const` object (see existing file for pattern).

## Scripts Reference

```bash
./scripts/manage.sh deploy              # Install WASM + deploy
./scripts/manage.sh initialize ...       # Configure sale
./scripts/manage.sh contribute <addr> <amt>
./scripts/manage.sh claim <addr>
./scripts/manage.sh fund <admin> <amt>
./scripts/manage.sh withdraw <admin>
./scripts/manage.sh cancel <admin>
./scripts/manage.sh refund <caller>
./scripts/manage.sh info                 # Read sale state
./scripts/manage.sh contributor <addr>
./scripts/manage.sh claimable <addr>
```

Set `SOURCE`, `STELLAR_NETWORK`, `RPC_URL`, `NETWORK_PASSPHRASE` via environment.

## Tech Stack

- **Smart Contract**: Rust + Soroban SDK 26
- **Frontend**: React 19 + TypeScript 6 + Tailwind CSS v4 + Vite 8
- **Wallet**: Freighter (via `@stellar/freighter-api`)
- **Stellar SDK**: `@stellar/stellar-sdk` v15

## License

MIT — see [LICENSE](./LICENSE).
