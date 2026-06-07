# Token Launchpad

A **token launchpad** smart contract on Soroban (Stellar) with a full React frontend. Projects use it to conduct token sales: investors contribute deposit tokens (e.g. USDC) during a configured sale window and receive project tokens with optional cliff + linear vesting.

---

- [Overview](#overview)
- [Sale Lifecycle](#sale-lifecycle)
- [Vesting Model](#vesting-model)
- [Architecture](#architecture)
- [Contract API Reference](#contract-api-reference)
- [Error Reference](#error-reference)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [End-to-End Walkthrough](#end-to-end-walkthrough)
- [Deployment Guide](#deployment-guide)
- [Frontend Architecture](#frontend-architecture)
- [Testing](#testing)
- [Scripts Reference](#scripts-reference)
- [Configuration Reference](#configuration-reference)
- [Security Considerations](#security-considerations)
- [Regenerating TypeScript Bindings](#regenerating-typescript-bindings)
- [Troubleshooting](#troubleshooting)
- [Tech Stack](#tech-stack)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

The Token Launchpad is a dual-token sale contract:

- **deposit_token** — what investors pay with (e.g. USDC, XLM)
- **token** — what investors receive (the project's own token)

The admin configures a sale with price, hard cap, soft cap, start/end times, and vesting parameters. During the sale window, anyone can contribute deposit tokens and receive an allocation. After the sale ends:

- If **soft cap** is reached → admin can withdraw deposits; investors claim vested tokens over time
- If **soft cap is not reached** → investors can refund their deposits
- **Cancellation** by admin at any time → all investors can refund

## Sale Lifecycle

```
  UPCOMING         LIVE              ENDED
    |               |                  |
    |  start        |   end            |  cliff_end         full_end
    |               |                  |                     |
    ▼               ▼                  ▼                     ▼
  ┌──────┐       ┌──────┐          ┌──────┐              ┌──────┐
  │ init │──────▶│ sale │─────────▶│cliff │──────────────▶│ full │
  │      │       │open  │          │period│  linear       │vested│
  └──────┘       └──────┘          └──────┘  vesting      └──────┘
                                          ───────────────────▶
                                           vesting_duration
```

| Phase | Condition | What happens |
|-------|-----------|-------------|
| **Upcoming** | `now < start` | No contributions allowed. Admin can still fund tokens. |
| **Live** | `start <= now <= end` | Investors contribute deposit tokens. Allocation is tracked per-address. |
| **Cliff** | `end < now <= end + cliff` | Sale ended. No claiming yet. Vesting hasn't started. Admin can withdraw if soft cap met. Refunds if soft cap not met or cancelled. |
| **Vesting** | `end + cliff < now < end + cliff + vesting_duration` | Tokens vest linearly. Investors claim the vested portion at any time. |
| **Fully Vested** | `now >= end + cliff + vesting_duration` | 100% of tokens claimable. |

## Vesting Model

Vesting is controlled by two parameters set during `initialize`:

- **cliff** (seconds) — how long after `end` before any tokens vest. During the cliff period, `available = 0`.
- **vesting_duration** (seconds) — how long the linear release takes after the cliff ends.

If `vesting_duration == 0`, there is **no vesting** — 100% of tokens are available at TGE (the moment `end` passes, subject to the cliff).

### Vesting Formula

```
cliff_end = end + cliff
full_end = cliff_end + vesting_duration

if vesting_duration == 0:
    vested = 100%
else if now >= full_end:
    vested = 100%
else if now <= cliff_end:
    vested = 0%
else:
    elapsed = now - cliff_end
    vested_pct = elapsed / vesting_duration
    vested = total_bought * vested_pct
```

Claimable amount at any time: `vested - already_claimed`.

### Example

- Sale ends at `t=1000`
- Cliff = 500s, Vesting = 2000s
- Alice bought 1000 tokens

| Time | Elapsed | Vesting % | Vested | Claimable |
|------|---------|-----------|--------|-----------|
| t=1000 (end) | 0 | 0% | 0 | 0 |
| t=1500 (cliff_end) | 0 | 0% | 0 | 0 |
| t=2000 | 500s | 25% | 250 | 250 |
| t=3000 | 1500s | 75% | 750 | 500 (if 250 already claimed) |
| t=3500 (full_end) | 2000s | 100% | 1000 | 250 (if 750 already claimed) |

## Architecture

```
token_launchpad/
├── contracts/
│   └── token_launchpad/        # Soroban smart contract (Rust)
│       ├── src/
│       │   ├── lib.rs          # Contract logic (10 exported functions)
│       │   └── test.rs         # 9 unit tests with snapshot assertions
│       ├── test_snapshots/     # Snapshot files for test assertions
│       ├── Cargo.toml          # Contract dependencies
│       └── Makefile            # Build helpers
│
├── frontend/                   # React SPA (Vite + TypeScript + Tailwind CSS v4)
│   └── src/
│       ├── components/
│       │   ├── WalletBar.tsx       # Freighter connect/disconnect display
│       │   ├── AdminPanel.tsx      # Admin: create, fund, withdraw, cancel
│       │   └── ContributePanel.tsx # User: contribute, claim, refund
│       ├── hooks/
│       │   ├── useWallet.ts        # Freighter wallet state management
│       │   └── useLaunchpad.ts     # Contract read/write state management
│       ├── lib/
│       │   └── stellar.ts          # Contract client creation, all RPC wrappers
│       ├── contract/               # TypeScript bindings (built from WASM spec)
│       │   └── src/index.ts        # Generated Client class + TypeScript types
│       ├── App.tsx                 # Root component, routing, layout
│       ├── main.tsx                # Entry point
│       └── index.css               # Tailwind v4 import
│
├── scripts/
│   ├── manage.mjs              # CLI deploy/management tool (Node.js)
│   ├── manage.sh               # Bash wrapper for manage.mjs
│   └── regenerate-bindings.sh  # Regenerate TS bindings from compiled WASM
│
├── .github/workflows/
│   └── ci.yml                  # GitHub Actions: fmt, clippy, test, tsc, build
│
├── Cargo.toml                  # Workspace root
├── Cargo.lock
├── LICENSE                     # MIT
├── .gitignore
├── CHANGELOG.md
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
└── README.md
```

## Contract API Reference

### Storage Model

- `LAUNCHPAD` — single `LaunchpadInfo` struct (instance storage)
- `CONTRIBUTORS` — `Map<Address, ContributorInfo>` mapping contributors to their position

### `initialize`

Creates a new launchpad sale. Can only be called once.

```
initialize(admin: Address, token: Address, deposit_token: Address,
           price: u64, cap: u64, soft_cap: u64,
           start: u64, end: u64,
           cliff: u64, vesting_duration: u64)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `admin` | Address | Who can fund, withdraw deposits, cancel |
| `token` | Address | Contract address of the token being sold |
| `deposit_token` | Address | Contract address of the payment token (e.g. USDC) |
| `price` | u64 | Deposit tokens required per sale token (7-decimal units) |
| `cap` | u64 | Hard cap in deposit token units |
| `soft_cap` | u64 | Minimum raise; if not met, investors can refund |
| `start` | u64 | Unix timestamp (seconds) when sale opens |
| `end` | u64 | Unix timestamp (seconds) when sale closes |
| `cliff` | u64 | Seconds after `end` before vesting begins (0 = no cliff) |
| `vesting_duration` | u64 | Seconds of linear vesting after cliff (0 = no vesting, 100% at TGE) |

**Auth**: `admin.require_auth()`  
**Panics**: `AlreadyInitialized`, `NotAdmin` (via require_auth)

---

### `contribute`

Investor sends deposit tokens to receive an allocation.

```
contribute(caller: Address, amount: u64)
```

- Transfers `amount` of `deposit_token` from caller to contract
- Credits caller with `amount * price` sale tokens
- Reverts if the sale would exceed `cap`

**Auth**: `caller.require_auth()`  
**Panics**: `NotInitialized`, `SaleNotActive`, `CapReached`, `Cancelled`  
**Precondition**: Caller must have approved the contract as a spender on the deposit token (or the contract initiates a `transfer_from` — in Soroban, the caller signs the auth entry directly, so approval is implicit in the transaction)

---

### `claim`

Investor withdraws their vested tokens.

```
claim(caller: Address)
```

- Computes vested amount based on time since sale end
- Transfers vested - already_claimed tokens from contract to caller

**Auth**: `caller.require_auth()`  
**Panics**: `NotInitialized`, `NoContribution`, `NothingToClaim`  
**Precondition**: Contract must have sufficient `token` balance (admin must have called `fund`)

---

### `fund`

Admin deposits sale tokens into the contract so investors can claim them.

```
fund(admin: Address, amount: u64)
```

- Transfers `amount` of `token` from admin to contract
- Does not check against cap — admin can fund more than needed (excess stays in contract)

**Auth**: `admin.require_auth()`  
**Panics**: `NotInitialized`, `NotAdmin`

---

### `withdraw_deposits`

Admin collects all deposit tokens after the sale ends successfully (soft cap met).

```
withdraw_deposits(admin: Address)
```

- Transfers the contract's entire `deposit_token` balance to admin
- Can only be called after `end` (or if cancelled) AND soft cap is met (unless cancelled)

**Auth**: `admin.require_auth()`  
**Panics**: `NotInitialized`, `NotAdmin`, `SaleNotEnded`, `BelowSoftCap`

---

### `cancel`

Admin performs an emergency stop of the sale.

```
cancel(admin: Address)
```

- Sets `cancelled = true`
- After cancellation, investors can call `refund` to get their deposits back
- Admin can still call `withdraw_deposits` even if soft cap not met

**Auth**: `admin.require_auth()`  
**Panics**: `NotInitialized`, `NotAdmin`

---

### `refund`

Investor reclaims their deposit tokens when the sale is cancelled or soft cap was not met.

```
refund(caller: Address)
```

- Transfers the caller's full `contributed` amount of `deposit_token` back
- Removes caller from the contributors map

**Auth**: `caller.require_auth()`  
**Panics**: `NotInitialized`, `NoContribution`, `Cancelled` (when sale succeeded — soft cap met and not cancelled)

---

### `get_launchpad_info`

Read the full sale state. Read-only, no auth required.

```
get_launchpad_info() -> LaunchpadInfo
```

**Panics**: `NotInitialized`

### `get_contributor_info`

Read an investor's contribution, tokens bought, and tokens claimed.

```
get_contributor_info(address: Address) -> ContributorInfo
```

Returns a zeroed `ContributorInfo` if the address has not contributed (no panic).

### `get_claimable`

Read the vested and currently available (claimable) amounts for an investor.

```
get_claimable(address: Address) -> ClaimableAmount
```

Returns `{ vested: 0, available: 0 }` if the address has no contribution.

## Error Reference

All errors are `u32` error codes returned as contract panics.

| Code | Name | When it fires |
|------|------|--------------|
| 1 | `AlreadyInitialized` | `initialize` called a second time |
| 2 | `NotInitialized` | Any method called before `initialize` |
| 3 | `NotAdmin` | A method requiring admin auth is called by a non-admin |
| 4 | `SaleNotActive` | `contribute` called outside start..end window |
| 5 | `SaleNotEnded` | `withdraw_deposits` called before `end` (and not cancelled) |
| 6 | `CapReached` | `contribute` would exceed the hard cap |
| 7 | `BelowSoftCap` | `withdraw_deposits` called when soft cap not met (and not cancelled) |
| 8 | `NoContribution` | `claim` or `refund` called by an address with no contribution |
| 9 | `NothingToClaim` | `claim` called when available = 0 |
| 10 | `Cancelled` | `contribute` called after the sale was cancelled |

## Prerequisites

### Contract Development

```bash
# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Soroban CLI (for deployment and binding generation)
cargo install soroban-cli --features opt
```

### Frontend Development

```bash
# Node.js ≥ 20 (recommend via nvm or fnm)
nvm install 20

# Freighter browser wallet
# Install from: https://freighter.app/
# Switch to testnet in Freighter settings
```

## Quick Start

### 1. Build & Test the Contract

```bash
# Compile to WASM
cargo build --target wasm32-unknown-unknown --release

# Run all 9 unit tests
cargo test

# Run with output
cargo test -- --nocapture
```

### 2. Run the Frontend (dev mode)

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Opens at `http://localhost:5173`. Connect Freighter and enter a deployed contract ID.

### 3. Deploy to Testnet

```bash
# Set up an identity in Soroban CLI
stellar keys generate my-key
stellar keys fund my-key --network testnet

# Deploy
SOURCE=my-key ./scripts/manage.sh deploy

# Initialize a sale
SOURCE=my-key ./scripts/manage.sh initialize \
  <your-public-key> \
  <token-contract-address> \
  <deposit-token-contract-address> \
  10000000 1000000000 500000000 1730000000 1730086400 86400 604800
```

## End-to-End Walkthrough

This example walks through a complete sale lifecycle on testnet.

### Setup

```bash
# 1. Create identities
stellar keys generate admin-key
stellar keys generate investor-key
stellar keys fund admin-key --network testnet
stellar keys fund investor-key --network testnet

# 2. Deploy the launchpad contract
SOURCE=admin-key ./scripts/manage.sh deploy
# → saves contract ID to .contract-id
```

### Pre-sale: Deploy Tokens

You need two token contracts. Use the Stellar CLI's built-in token:

```bash
# Deploy a test token for the sale (the "project" token)
stellar contract asset deploy \
  --asset "native:$(stellar keys address admin-key)" \
  --source admin-key \
  --network testnet

# Deploy a test USDC-like token (the deposit token)
stellar contract asset deploy \
  --asset "USDC:$(stellar keys address admin-key)" \
  --source admin-key \
  --network testnet

# Mint tokens to admin
stellar contract invoke \
  --id <token-id> \
  --source admin-key \
  --network testnet \
  -- \
  mint \
  --to "$(stellar keys address admin-key)" \
  --amount 10000000000
```

### Phase 1: Initialize

```bash
NOW=$(date +%s)
START=$((NOW + 300))        # sale opens in 5 minutes
END=$((START + 3600))       # sale runs for 1 hour
CLIFF=86400                 # 1 day cliff after end
VESTING=604800              # 1 week linear vesting
CAP=1000000000              # 100 token hard cap (7-decimal)
SOFT_CAP=500000000          # 50 token soft cap
PRICE=10000000              # 1 deposit token per sale token

SOURCE=admin-key ./scripts/manage.sh initialize \
  "$(stellar keys address admin-key)" \
  <token-address> \
  <deposit-token-address> \
  $PRICE $CAP $SOFT_CAP $START $END $CLIFF $VESTING
```

### Phase 2: Fund

Admin funds the contract with sale tokens:

```bash
SOURCE=admin-key ./scripts/manage.sh fund \
  "$(stellar keys address admin-key)" \
  1000000000
```

### Phase 3: Contribute (during sale window)

```bash
# Investor approves the launchpad contract as spender, then contributes
# (The Soroban SDK handles auth entries — just sign the transaction)
SOURCE=investor-key ./scripts/manage.sh contribute \
  "$(stellar keys address investor-key)" \
  100000000
```

Check contribution:

```bash
./scripts/manage.sh contributor "$(stellar keys address investor-key)"
```

### Phase 4: After sale ends

If soft cap met:

```bash
# Admin collects deposits
SOURCE=admin-key ./scripts/manage.sh withdraw \
  "$(stellar keys address admin-key)"
```

After cliff + vesting period:

```bash
# Investor claims vested tokens
SOURCE=investor-key ./scripts/manage.sh claim \
  "$(stellar keys address investor-key)"
```

### Phase 4 (alternative): Refund

If sale cancelled or soft cap not met:

```bash
SOURCE=investor-key ./scripts/manage.sh refund \
  "$(stellar keys address investor-key)"
```

## Deployment Guide

### Setting Up a Stellar Identity

```bash
# Generate a new keypair (saved to ~/.stellar/keys/)
stellar keys generate my-project-key

# Fund it on testnet
stellar keys fund my-project-key --network testnet

# Check balance
stellar keys balance my-project-key --network testnet

# Or use an existing secret key
stellar keys add my-project-key --secret-key S...
```

### Deploying to Mainnet

**⚠️ Test thoroughly on testnet first before mainnet deployment.**

```bash
export SOURCE=my-mainnet-key
export STELLAR_NETWORK=public
export RPC_URL=https://soroban-rpc.stellar.org
export NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"

./scripts/manage.sh deploy
```

Note: Mainnet requires funded accounts (XLM for fees, minimum 10 XLM balance).

### Verifying Deployment

```bash
# Check sale info
./scripts/manage.sh info

# Should show all initialized parameters
```

## Frontend Architecture

### Component Tree

```
App
├── WalletBar                 # Connect/disconnect, show truncated key
├── ContributePanel           # Sale info, progress bar, contribute form
│   ├── StatusBadge           # UPCOMING / LIVE / ENDED / CANCELLED
│   ├── Progress Bar          # Hard cap progress
│   └── Your Position         # Current user's contribution, claim/refund
└── AdminPanel (toggleable)   # Create, fund, withdraw, cancel
```

### Data Flow

```
Freighter Extension
       ↕ (signTransaction / getAddress)
useWallet hook
       ↕ (pubKey, signTransaction)
useLaunchpad hook (creates Client with signTransaction)
       ↕ (read methods: get_launchpad_info, get_contributor_info, get_claimable)
      Client.signAndSend() triggers Freighter popup for user approval
       ↕ (write methods: contribute, claim, refund, initialize, fund, ...)
Soroban RPC (testnet/public)
       ↕
  Contract WASM
```

### State Management

State is managed locally with React hooks (`useState`, `useEffect`, `useCallback`). No global state library needed at this scale.

- `useWallet` — wallet connection state
- `useLaunchpad` — contract read state (`info`, `contrib`, `claimable`) + write actions (`doContribute`, `doClaim`, `doRefund`)
- Components auto-refresh after mutations via `useEffect` triggered by `refresh()`

## Testing

### Contract Tests (9 tests)

Run with `cargo test`:

| Test | Description |
|------|-------------|
| `test_initialize` | Creates a launchpad, verifies stored state |
| `test_double_initialize` | Verifies second `initialize` panics |
| `test_contribute` | Contribute during sale window, verify balances |
| `test_contribute_before_start` | Verify contribute before `start` panics |
| `test_claim_after_vesting` | Full lifecycle: initialize → contribute → time advance → claim |
| `test_get_claimable` | Verify `get_claimable` returns correct vesting math |
| `test_withdraw_before_end` | Verify withdraw before `end` panics |
| `test_withdraw_after_sale_meets_soft_cap` | Full lifecycle: contribute enough to meet soft cap, then withdraw after end |
| `test_cancel_and_refund` | Cancel during sale, then refund investor |

Tests use Soroban's `testutils` with `Env::test()` and `Ledger` time manipulation to simulate time passing.

### Adding Tests

```rust
// In test.rs:
use soroban_sdk::{testutils::Ledger, Env};

#[test]
fn my_new_test() {
    let env = Env::default();
    // ... setup, then:
    env.ledger().set_timestamp(desired_time);
    // ... assertions
}
```

### Frontend Verification

```bash
cd frontend

# TypeScript type checking
npx tsc -b

# Full production build
npm run build

# Dev server with hot reload
npm run dev
```

## Scripts Reference

### `scripts/manage.sh`

| Command | Description |
|---------|-------------|
| `deploy` | Install WASM to network + deploy contract, saves ID to `.contract-id` |
| `install` | Only install WASM, prints the hash |
| `initialize <admin> <token> <deposit> <price> <cap> <soft> <start> <end> [cliff] [vesting]` | Configure sale parameters |
| `contribute <caller> <amount>` | Contribute deposit tokens |
| `claim <caller>` | Claim vested tokens |
| `refund <caller>` | Refund deposit (cancelled or below soft cap) |
| `fund <admin> <amount>` | Admin deposits sale tokens |
| `withdraw <admin>` | Admin collects deposits |
| `cancel <admin>` | Emergency stop |
| `info` | Read `LaunchpadInfo` |
| `contributor <address>` | Read `ContributorInfo` |
| `claimable <address>` | Read `ClaimableAmount` |
| `id` | Print saved contract ID |

### `scripts/regenerate-bindings.sh`

Regenerates TypeScript contract bindings from compiled WASM. Requires Soroban CLI.

## Configuration Reference

### Frontend Environment Variables (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_RPC_URL` | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint |
| `VITE_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` | Network passphrase for signing |
| `VITE_CONTRACT_ID` | — | Deployed launchpad contract ID |

### Script Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SOURCE` | `default` | Stellar identity (from `stellar keys`) or secret key |
| `STELLAR_NETWORK` | `testnet` | Network name for the CLI |
| `RPC_URL` | `https://soroban-testnet.stellar.org` | RPC endpoint |
| `NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` | Network passphrase |

## Security Considerations

### Authentication Model

- All state-changing functions require `require_auth()` on the calling address
- Soroban's host-function-level auth means the wallet must sign the transaction envelope + auth entries
- The frontend uses Freighter's `signTransaction` — the Stellar SDK `Client` passes it directly, so users see exactly what they're signing in Freighter's popup

### Token Safety

- The contract uses Soroban's built-in `token::TokenClient` for all transfers
- Transfers use `transfer()`, not `transfer_from()` — the sender signs each transfer individually via Soroban auth entries
- The contract never holds more tokens than those sent to it
- `withdraw_deposits` transfers the **entire** deposit token balance — if someone sends tokens directly to the contract, those would be swept up too

### Edge Cases

- **Over-funding**: Admin can fund more tokens than the cap requires — excess remains in the contract (no recovery unless the contract is extended)
- **Direct transfers**: Tokens sent directly to the contract address are not tracked — they're only accessible via `withdraw_deposits` (deposit tokens) or not at all (sale tokens)
- **Zero-address**: Soroban addresses are validated at the host level — passing an invalid address will fail during simulation
- **Time manipulation**: Investors cannot influence on-chain time — it comes from the Stellar ledger consensus
- **Re-entrancy**: Soroban's host functions are not re-entrant — token callbacks are safe

### Known Limitations

- The contract does not implement a **whitelist** — any address can contribute
- No **max contribution per address** — a single investor can buy the entire cap
- No **partial refunds** on cancellation — the investor gets their full contribution back
- No **batch claim** — each investor must claim individually

## Regenerating TypeScript Bindings

When the contract interface changes:

```bash
# 1. Build WASM
cargo build --target wasm32-unknown-unknown --release

# 2. Generate bindings
stellar contract bindings typescript \
  --wasm contracts/token_launchpad/target/wasm32-unknown-unknown/release/token_launchpad.wasm \
  --output-dir frontend/src/contract \
  --contract-id <contract-id>

# 3. Fix TypeScript 6.0 compatibility
# The generated file uses `enum` which is not allowed with
# `erasableSyntaxOnly`. Convert the enum to a const object:
#
#   const ContractError = {
#     AlreadyInitialized: 1,
#     NotInitialized: 2,
#     ...
#   } as const;
#
# See the existing frontend/src/contract/src/index.ts for the full pattern.
```

Or use the convenience script:

```bash
./scripts/regenerate-bindings.sh <contract-id>
```

## Troubleshooting

### "not initialized" when calling any method

The contract hasn't been initialized yet. Call `initialize` with your sale parameters.

### "sale not active" on contribute

Check that `now` is between `start` and `end`. Verify with `./scripts/manage.sh info`.

### "cap reached" on contribute

The sale is full. No more contributions accepted. Deploy a new launchpad with a higher cap if needed.

### Freighter doesn't pop up

- Ensure Freighter extension is installed and unlocked
- Refresh the page
- Check browser console for errors
- Ensure you're on the correct network (testnet vs mainnet)

### Transaction fails with "insufficient funds"

- The caller needs XLM for the transaction fee (minimum ~0.001 XLM per Soroban transaction)
- The caller must have enough deposit tokens and have approved the contract

### "below soft cap" on withdraw

Not enough investors participated. Either wait for more contributions or cancel the sale so investors can refund.

### Build fails: wasm32 target not found

```bash
rustup target add wasm32-unknown-unknown
```

### Build fails: soroban-sdk version mismatch

Ensure your `Cargo.toml` matches the installed Soroban CLI version. See [Soroban docs](https://soroban.stellar.org/docs).

### Frontend shows "No launchpad found"

The contract ID is wrong, or the contract hasn't been initialized. Check `VITE_CONTRACT_ID` in `.env` or the input field.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart contract | Rust + Soroban SDK 26 |
| Contract build | `wasm32-unknown-unknown` target, optimized release profile |
| Frontend framework | React 19 |
| Type system | TypeScript 6 |
| Styling | Tailwind CSS v4 |
| Build tool | Vite 8 |
| Wallet | Freighter (via `@stellar/freighter-api`) |
| Stellar SDK | `@stellar/stellar-sdk` v15 |
| Charts | Recharts (available, not yet integrated) |
| CI | GitHub Actions (fmt, clippy, test, tsc, build) |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development workflow, code style, and PR checklist.

This project is governed by the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md).

## License

MIT — see [LICENSE](./LICENSE).
