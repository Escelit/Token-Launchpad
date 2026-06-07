# Token Launchpad

**Build, launch, and manage token sales on Stellar — without intermediaries.**

[![CI](https://github.com/Escelit/Token-Launchpad/actions/workflows/ci.yml/badge.svg)](https://github.com/Escelit/Token-Launchpad/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-1.79+-deaL?logo=rust)](https://www.rust-lang.org)
[![Soroban SDK](https://img.shields.io/badge/Soroban_SDK-26-blue)](#tech-stack)

```text
                  ╔══════════════════════════════════════╗
                  ║          TOKEN LAUNCHPAD             ║
                  ║  Soroban Smart Contract + React UI   ║
                  ╚══════════════════════════════════════╝
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ Project  │  │ Investor │  │  Admin   │
    │  Token   │  │Contribute│  │Controls  │
    └──────────┘  └──────────┘  └──────────┘
```

---

- [Why This Exists](#why-this-exists)
- [How It Works](#how-it-works)
- [Sale Lifecycle](#sale-lifecycle)
- [Vesting, Explained](#vesting-explained)
- [Project Structure](#project-structure)
- [Contract API](#contract-api)
- [Error Reference](#error-reference)
- [Get Started in 5 Minutes](#get-started-in-5-minutes)
- [End-to-End Walkthrough](#end-to-end-walkthrough)
- [Frontend Overview](#frontend-overview)
- [Testing Philosophy](#testing-philosophy)
- [Deployment Guide](#deployment-guide)
- [Security & Edge Cases](#security--edge-cases)
- [Roadmap](#roadmap)
- [Configuration Reference](#configuration-reference)
- [Troubleshooting](#troubleshooting)
- [Tech Stack](#tech-stack)
- [Contributing](#contributing)
- [License](#license)

---

## Why This Exists

Running a token sale today means trusting a third-party platform, paying hefty fees, and surrendering control over your community's data. **It doesn't have to be that way.**

The Token Launchpad is an **open, self-sovereign alternative** — a Soroban smart contract that lets any project run its own compliant token sale on Stellar. No intermediaries. No platform lock-in. Just a contract, a frontend, and your community.

### Who this is for

| Role | What they get |
|------|--------------|
| **Project teams** | A turnkey sale contract they deploy and control. Configurable price, caps, timing, and vesting — all set by them, not a platform. |
| **Investors** | A transparent, on-chain sale. They see exactly what they're buying, when tokens unlock, and can refund if things go wrong. Freighter wallet, one click. |
| **Developers** | Clean Rust code (9 tests, 10KB WASM), generated TypeScript bindings, and a reference React frontend to fork or embed. |

### What makes it different

- **Dual-token model** — deposit with USDC-like tokens, receive project tokens
- **Cliff + linear vesting** built in, not bolted on
- **Soft cap protection** — investors get refunds if the minimum raise isn't met
- **Emergency cancel** — admin can halt, investors can always withdraw
- **10KB WASM** — minimal, auditable surface area
- **No external dependencies** for sale logic — pure Soroban host functions

---

## How It Works

The launchpad is a **dual-token sale contract**. Two tokens, one sale:

```
             CONTRIBUTE                      CLAIM
  ┌──────────────┐                    ┌──────────────┐
  │  Investor    │  deposit_token     │  Investor    │
  │  (caller)    │ ──────────────────▶│  (caller)    │
  │              │    goes to         │              │
  │  sends       │   contract         │  receives    │◀─────────────────────┐
  │  deposit     │                    │  vested      │                      │
  │  tokens      │                    │  tokens      │                      │
  └──────┬───────┘                    └──────────────┘                      │
         │                                                                  │
         │  tracked in storage                                               │
         ▼                                                                  │
  ┌──────────────┐                    ┌──────────────┐                      │
  │  Contract    │                    │  Contract    │──────────────────────┘
  │  records     │                    │  releases    │  token transfer
  │  allocation  │                    │  vested amt  │  (must be funded
  └──────────────┘                    └──────────────┘  by admin first)
         ▲
         │  FUND
  ┌──────┴───────┐
  │   Admin      │
  │              │
  │  deposits    │
  │  sale tokens │
  └──────────────┘
```

### The cast

| Role | Who |
|------|-----|
| **`deposit_token`** | What investors pay with. USDC, XLM, or any Soroban token. |
| **`token`** | What investors receive. The project's token. |
| **Admin** | The project team. Sets parameters, funds the pool, withdraws deposits, can cancel. |
| **Caller** | Any address. Contributes, claims, or refunds. |

---

## Sale Lifecycle

A sale moves through four phases. Here's the full picture:

```text
     ╔══════════╗     ╔══════════╗     ╔══════════╗     ╔══════════╗
     ║ UPCOMING ║     ║   LIVE   ║     ║  CLIFF   ║     ║  VESTING ║
     ║          ║     ║          ║     ║          ║     ║          ║
     ║  silent  ║────▶║  active  ║────▶║  frozen  ║────▶║  linear  ║────▶ time
     ║  before  ║     ║  sale    ║     ║  no      ║     ║  release ║
     ║  start   ║     ║  window  ║     ║  claims  ║     ║          ║
     ╚══════════╝     ╚══════════╝     ╚══════════╝     ╚══════════╝
           │                │                │                 │
           │                │                │                 │
     nothing yet      invest here      admin can        claim anytime
                       deposit tokens   withdraw
                       get allocation   deposits
                       token price      (if soft
                       is fixed         cap met)
                                         or refund
                                         (if not)
```

| Phase | Timeline | What's happening | Can you contribute? | Can you claim? |
|-------|----------|-----------------|:---:|:---:|
| **Upcoming** | `now < start` | Admin can still fund tokens into the pool. Sale is invisible to investors. | ❌ | ❌ |
| **Live** | `start ≤ now ≤ end` | Investors send deposit tokens. Each contribution is recorded and allocated. Price is fixed. | ✅ | ❌ |
| **Cliff** | `end < now ≤ end + cliff` | Sale is over. No tokens vest yet. Admin assesses if soft cap was met — withdraws deposits or investors refund. | ❌ | ❌ |
| **Vesting** | `end + cliff < now < full_end` | Tokens unlock linearly every second. Investors claim whenever they want. | ❌ | ✅ (partial) |
| **Fully vested** | `now ≥ full_end` | All tokens unlocked. Everyone can claim everything they're owed. | ❌ | ✅ (all) |

### What can go wrong (and how the contract handles it)

- **Sale is cancelled by admin** → anyone can refund their full contribution at any time
- **Soft cap not met by the end** → admin cannot withdraw; investors can refund
- **Hard cap reached mid-sale** → no more contributions accepted (transaction reverts)

---

## Vesting, Explained

Vesting prevents early investors from dumping tokens the moment a sale ends. The launchpad supports a **cliff + linear release** model — the industry standard used by most serious projects.

### The two knobs

```text
      end                  cliff_end                       full_end
       │                       │                              │
       │       cliff           │        vesting_duration       │
       │◄─────────────────────►│◄─────────────────────────────►│
       │                       │                              │
       │   100% locked         │     tokens unlock linearly    │
       │                       │     │                        │
       │                       │     ▼ rate = const           │
       ▼                       ▼  ┌──────────────────────┐    ▼
  ┌────────────────────────────┐  │                      │  ┌──────┐
  │       NO CLAIMS            │  │   CLAIM ANYTIME      │  │  100%│
  │                            │  │   (whatever has       │  │ UN-  │
  │       🗲                    │  │    vested so far)     │  │LOCKED│
  └────────────────────────────┘  └──────────────────────┘  └──────┘
```

- **`cliff`** — seconds after `end` during which nothing vests. Set to `0` for no cliff.
- **`vesting_duration`** — seconds of linear release after the cliff. Set to `0` for 100% at TGE (no vesting).

### The math (one formula)

```
cliff_end  = end + cliff
full_end   = cliff_end + vesting_duration

vested(now) = if vesting_duration == 0          → total_bought
              else if now >= full_end           → total_bought
              else if now <= cliff_end          → 0
              else                              → total_bought × (now - cliff_end) / vesting_duration

claimable(now) = vested(now) - already_claimed
```

### Worked example

Alice contributes during a sale where:
- `end = 1000`, `cliff = 500s`, `vesting_duration = 2000s`
- She bought **1,000 tokens**

```text
1000 ──── 1500 ──── 2000 ──── 2500 ──── 3000 ──── 3500
 │        │        │        │        │        │
 end    cliff     25%      50%      75%     100%
         end    vested   vested   vested   vested
                  250      500      750     1000
                claimable
```

| Time | Event | Vested | Claimable | Why |
|------|-------|:------:|:---------:|-----|
| `t=1000` | Sale ends | 0 | 0 | Cliff hasn't started |
| `t=1500` | Cliff ends | 0 | 0 | Cliff just ended, 0s elapsed |
| `t=2000` | Vesting underway | 250 | 250 | 500s elapsed / 2000s = 25% |
| `t=2500` | Alice claims 250 | 500 | 250 (if she claimed 250 at t=2000) | Vested 500, claimed 250 |
| `t=3500` | Fully vested | 1,000 | 750 (if she claimed 500 total so far) | 100% unlocked |

---

## Project Structure

```
token_launchpad/
│
├── contracts/
│   └── token_launchpad/           # ◄── The smart contract
│       ├── src/
│       │   ├── lib.rs             #     10 exported functions, ~350 lines
│       │   └── test.rs            #     9 tests, snapshot-based assertions
│       ├── test_snapshots/        #     Golden file snapshots
│       ├── Cargo.toml             #     soroban-sdk 26, no other deps
│       └── Makefile
│
├── frontend/                      # ◄── Reference React app
│   ├── src/
│   │   ├── components/            #     WalletBar, AdminPanel, ContributePanel
│   │   ├── hooks/                 #     useWallet (Freighter), useLaunchpad (contract)
│   │   ├── lib/stellar.ts         #     RPC wrappers, helpers
│   │   └── contract/              #     Generated TypeScript bindings
│   ├── .env.example
│   └── package.json
│
├── scripts/                       # ◄── CLI tools
│   ├── manage.sh / manage.mjs     #     Deploy, initialize, contribute, claim...
│   └── regenerate-bindings.sh     #     Regenerate TS bindings from WASM
│
├── .github/workflows/ci.yml       # ◄── CI: fmt → clippy → test → tsc → build
├── Cargo.toml                     # Workspace root (soroban-sdk 26)
├── .gitignore
├── LICENSE                        # MIT
├── CHANGELOG.md
└── README.md
```

### Design philosophy

- **Minimal dependencies** — the contract depends only on `soroban-sdk`. No `serde`, no `thiserror`, no external crates.
- **Small WASM** — 10,901 bytes release build. Every kilobyte matters on-chain.
- **Snapshots over mocks** — tests use `test_snapshots` for golden-file assertions, not hand-written assertions for every field.
- **Bindings from spec** — TypeScript types are generated from the compiled WASM spec, ensuring contract and frontend are always in sync.

---

## Contract API

Ten functions. Three data types. One purpose.

### Storage

| Key | Type | Purpose |
|-----|------|---------|
| `"launchpad"` | `LaunchpadInfo` | Single struct with all sale parameters + state |
| `"contribs"` | `Map<Address, ContributorInfo>` | Per-address contribution tracking |

### Functions

#### `initialize` · *sets up the sale*

```rust
fn initialize(
    env: Env, admin: Address, token: Address, deposit_token: Address,
    price: u64, cap: u64, soft_cap: u64,
    start: u64, end: u64,
    cliff: u64, vesting_duration: u64,
)
```

| Argument | Meaning | Example |
|----------|---------|---------|
| `admin` | Who controls the sale | Your team's multisig |
| `token` | What you're selling | The project token |
| `deposit_token` | What you're accepting | USDC contract address |
| `price` | Deposit tokens per sale token (7-decimal) | `10000000` = 1 USDC per token |
| `cap` | Maximum deposit tokens to raise | `1000000000` = 100 tokens |
| `soft_cap` | Minimum for the sale to succeed | `500000000` = 50 tokens |
| `start` | Unix timestamp: sale opens | `1730000000` |
| `end` | Unix timestamp: sale closes | `1730086400` (24h later) |
| `cliff` | Seconds after end before vesting starts | `86400` (1 day) |
| `vesting_duration` | Seconds of linear vesting after cliff | `604800` (1 week) |

**Auth**: `admin.require_auth()` · **Panics**: `AlreadyInitialized`, auth failure

---

#### `contribute` · *invest in the sale*

```rust
fn contribute(env: Env, caller: Address, amount: u64)
```

Transfers `amount` of `deposit_token` from `caller` to the contract. Credits `caller` with `amount × price` sale tokens. Reverts if the hard cap would be exceeded.

**Auth**: `caller.require_auth()` · **Panics**: `NotInitialized`, `SaleNotActive`, `CapReached`, `Cancelled`

> **Soroban auth note**: The caller signs both the transaction envelope and a Soroban authorization entry for the token transfer. Freighter handles this transparently — the user sees two operations to approve.

---

#### `claim` · *withdraw vested tokens*

```rust
fn claim(env: Env, caller: Address)
```

Computes vested amount (`total_bought × elapsed / vesting_duration`) and transfers `vested - already_claimed` sale tokens from the contract to `caller`.

**Auth**: `caller.require_auth()` · **Panics**: `NotInitialized`, `NoContribution`, `NothingToClaim`

---

#### `fund` · *admin deposits sale tokens*

```rust
fn fund(env: Env, admin: Address, amount: u64)
```

Transfers `amount` of `token` from admin to the contract. Can be called at any time — even before the sale starts. Over-funding is allowed (excess stays in the contract).

**Auth**: `admin.require_auth()` · **Panics**: `NotInitialized`, `NotAdmin`

---

#### `withdraw_deposits` · *admin collects payments*

```rust
fn withdraw_deposits(env: Env, admin: Address)
```

Transfers the contract's entire `deposit_token` balance to admin. Callable after `end` if the soft cap was met, or immediately if the sale was cancelled.

**Auth**: `admin.require_auth()` · **Panics**: `NotInitialized`, `NotAdmin`, `SaleNotEnded`, `BelowSoftCap`

---

#### `cancel` · *emergency stop*

```rust
fn cancel(env: Env, admin: Address)
```

Sets `cancelled = true`. Investors can then call `refund` to get their full deposit back. Admin can still withdraw deposits even if soft cap wasn't met.

**Auth**: `admin.require_auth()` · **Panics**: `NotInitialized`, `NotAdmin`

---

#### `refund` · *investor exits*

```rust
fn refund(env: Env, caller: Address)
```

Transfers the caller's full `contributed` amount of `deposit_token` back. Removes the caller from the contributors map. Only works if the sale was cancelled or the soft cap was not reached.

**Auth**: `caller.require_auth()` · **Panics**: `NotInitialized`, `NoContribution`, `Cancelled` (sale succeeded)

---

#### `get_launchpad_info` · *read sale state*

```rust
fn get_launchpad_info(env: Env) -> LaunchpadInfo
```

Returns all sale parameters + `total_raised`, `total_tokens_sold`, and `cancelled` status. No auth required.

**Panics**: `NotInitialized`

---

#### `get_contributor_info` · *read investor position*

```rust
fn get_contributor_info(env: Env, address: Address) -> ContributorInfo
```

Returns `{ contributed, tokens_bought, tokens_claimed }` for any address. Returns zeroed struct if the address hasn't contributed (no panic).

---

#### `get_claimable` · *read available amount*

```rust
fn get_claimable(env: Env, address: Address) -> ClaimableAmount
```

Returns `{ vested, available }` where `available = vested - already_claimed`. Uses the same vesting math as `claim` but without mutating state.

---

## Error Reference

| Code | Name | Fires when... |
|:----:|------|---------------|
| 1 | `AlreadyInitialized` | Someone calls `initialize` on an already-configured contract |
| 2 | `NotInitialized` | Any method is called before `initialize` |
| 3 | `NotAdmin` | A non-admin calls an admin-only method |
| 4 | `SaleNotActive` | `contribute` is called before `start` or after `end` |
| 5 | `SaleNotEnded` | `withdraw_deposits` is called before the sale ends (and it's not cancelled) |
| 6 | `CapReached` | A contribution would push `total_raised` over the hard cap |
| 7 | `BelowSoftCap` | `withdraw_deposits` is called before the soft cap is met (and it's not cancelled) |
| 8 | `NoContribution` | `claim` or `refund` is called by someone who never contributed |
| 9 | `NothingToClaim` | `claim` is called when `available = 0` |
| 10 | `Cancelled` | `contribute` is called after the admin cancelled the sale |

---

## Get Started in 5 Minutes

### Prerequisites

```bash
# Rust + WASM target
rustup target add wasm32-unknown-unknown

# Soroban CLI (for deployment)
cargo install soroban-cli --features opt

# Node.js ≥ 20
# Freighter wallet extension
```

### 1. Build & test the contract

```bash
cargo build --target wasm32-unknown-unknown --release
cargo test                          # 9 tests, all pass
```

### 2. Start the frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                         # → http://localhost:5173
```

### 3. Deploy & initialize

```bash
stellar keys generate my-key
stellar keys fund my-key --network testnet

SOURCE=my-key ./scripts/manage.sh deploy

SOURCE=my-key ./scripts/manage.sh initialize \
  <your-address> <token-address> <deposit-address> \
  10000000 1000000000 500000000 1730000000 1730086400 86400 604800
```

That's it. Your sale is live (or scheduled). See the [walkthrough](#end-to-end-walkthrough) for the full lifecycle.

---

## End-to-End Walkthrough

A complete sale, from zero to claim. Every command, every output, every edge case.

### Setup identities

```bash
stellar keys generate admin-key
stellar keys generate investor-key
stellar keys fund admin-key --network testnet
stellar keys fund investor-key --network testnet
```

### Deploy the launchpad

```bash
SOURCE=admin-key ./scripts/manage.sh deploy
# → Contract ID saved to .contract-id
```

### Deploy tokens (test assets)

```bash
# Deploy a native asset as the "project token"
stellar contract asset deploy \
  --asset "native:$(stellar keys address admin-key)" \
  --source admin-key --network testnet

# Deploy a USDC-like "deposit token"
stellar contract asset deploy \
  --asset "USDC:$(stellar keys address admin-key)" \
  --source admin-key --network testnet

# Mint both to admin
for id in <token-id> <deposit-token-id>; do
  stellar contract invoke \
    --id "$id" --source admin-key --network testnet -- \
    mint --to "$(stellar keys address admin-key)" --amount 10000000000
done
```

### Initialize the sale

```bash
NOW=$(date +%s)
START=$((NOW + 300))        # opens in 5 min
END=$((START + 3600))       # runs for 1 hour
CLIFF=86400                 # 1-day cliff
VESTING=604800              # 1-week vesting
CAP=1000000000              # 100 tokens
SOFT_CAP=500000000          # 50 tokens
PRICE=10000000              # 1 deposit token per sale token

SOURCE=admin-key ./scripts/manage.sh initialize \
  "$(stellar keys address admin-key)" \
  <token-id> <deposit-id> \
  $PRICE $CAP $SOFT_CAP $START $END $CLIFF $VESTING
```

### Fund the pool

```bash
SOURCE=admin-key ./scripts/manage.sh fund \
  "$(stellar keys address admin-key)" 1000000000
```

### Contribute (during sale window)

```bash
# Before contributing, the investor needs deposit tokens
stellar contract invoke \
  --id <deposit-id> --source admin-key --network testnet -- \
  transfer --from "$(stellar keys address admin-key)" \
  --to "$(stellar keys address investor-key)" \
  --amount 1000000000

# Then contribute
SOURCE=investor-key ./scripts/manage.sh contribute \
  "$(stellar keys address investor-key)" 100000000

# Verify
./scripts/manage.sh contributor "$(stellar keys address investor-key)"
# → { contributed: 100000000, tokens_bought: 10, tokens_claimed: 0 }
```

### After sale ends

**If soft cap met → admin withdraws:**

```bash
SOURCE=admin-key ./scripts/manage.sh withdraw \
  "$(stellar keys address admin-key)"
```

**If soft cap not met → investor refunds:**

```bash
SOURCE=investor-key ./scripts/manage.sh refund \
  "$(stellar keys address investor-key)"
```

### Claim vested tokens (after cliff + vesting)

```bash
SOURCE=investor-key ./scripts/manage.sh claim \
  "$(stellar keys address investor-key)"
```

---

## Frontend Overview

The frontend is a reference implementation — a **React SPA** that connects to Freighter and lets users interact with any deployed launchpad contract.

### What it does

| Panel | Purpose |
|-------|---------|
| **WalletBar** | Connect/disconnect Freighter. Shows truncated public key. |
| **ContributePanel** | Sale info card (price, cap, progress bar, status badge). Contribution form. Claim/refund buttons. |
| **AdminPanel** | Toggleable. Create sale, fund pool, withdraw deposits, cancel. |

### Data flow at a glance

```text
┌─────────────────────┐
│   Freighter Wallet  │
│  (signTransaction,  │
│   getAddress)        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    useWallet hook   │
│  pubKey, connected, │
│  connect(), signTx  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  useLaunchpad hook  │
│  → createClient()   │
│  → getLaunchpadInfo │
│  → getContributor   │
│  → getClaimable     │
│  → contribute()     │
│  → claim() / refund │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Soroban RPC       │
│  testnet/public     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Contract WASM      │
│  (10KB on-ledger)   │
└─────────────────────┘
```

### Key integration point

The Stellar SDK v15 `Client` accepts Freighter's `signTransaction` directly:

```typescript
const client = new Client({
  contractId,
  networkPassphrase,
  rpcUrl,
  publicKey,
  signTransaction,       // ← from Freighter
})

const tx = await client.contribute({ caller, amount })
const { result } = await tx.signAndSend()  // ← pops Freighter
```

No manual XDR assembly. No custom signing logic.

---

## Testing Philosophy

The contract has **9 tests** covering every function and every error case. Tests use **Soroban's `testutils`** with `Env::test()` and ledger time manipulation.

### What's tested

| Test | What it proves |
|------|----------------|
| `test_initialize` | Contract stores all parameters correctly |
| `test_double_initialize` | Second `initialize` is rejected (error 1) |
| `test_contribute` | Tokens transfer, allocation is recorded |
| `test_contribute_before_start` | Early contributions are rejected (error 4) |
| `test_claim_after_vesting` | Full lifecycle works end-to-end |
| `test_get_claimable` | Vesting math is correct at every time point |
| `test_withdraw_before_end` | Early withdrawal is rejected (error 5) |
| `test_withdraw_after_sale_meets_soft_cap` | Admin can collect after successful sale |
| `test_cancel_and_refund` | Cancel stops sale, investors get refunds |

### How tests work

```rust
use soroban_sdk::testutils::Ledger;

#[test]
fn test_claim_after_vesting() {
    let env = Env::default();
    // ... setup sale that ends at t=1000, cliff=500, vesting_duration=2000 ...

    // Advance past cliff + full vesting period
    env.ledger().set_timestamp(3500);

    // Claim should succeed with full amount
    launchpad.claim(&caller);
    // Assert token balance increased
}
```

### To add a test

```rust
#[test]
fn test_my_scenario() {
    let env = Env::default();
    // register contract, create accounts, initialize
    // manipulate time: env.ledger().set_timestamp(...)
    // call contract functions
    // assert results
}
```

---

## Deployment Guide

### Setting up a Stellar identity

```bash
# Generate (saved to ~/.stellar/keys/)
stellar keys generate my-project-key

# Fund on testnet
stellar keys fund my-project-key --network testnet

# Check balance
stellar keys balance my-project-key --network testnet

# Or import existing
stellar keys add my-project-key --secret-key S...
```

### Deploying to mainnet

```bash
export SOURCE=my-mainnet-key
export STELLAR_NETWORK=public
export RPC_URL=https://soroban-rpc.stellar.org
export NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"

./scripts/manage.sh deploy
```

**⚠️ Mainnet requires funded accounts** — 10 XLM minimum balance plus fees (~0.001 XLM per Soroban transaction).

### Verify deployment

```bash
./scripts/manage.sh info
# {
#   admin: "G...",
#   token: "C...",
#   price: 10000000,
#   cap: 1000000000,
#   ...
# }
```

---

## Security & Edge Cases

### Authentication

Every state-changing function uses `require_auth()`. The caller must sign the transaction in their wallet (Freighter, or via Soroban CLI). Soroban's host enforces this at the protocol level — the contract cannot be called without valid auth entries for every `require_auth()` call.

### Token safety

- All token transfers use Soroban's `token::TokenClient` — battle-tested by the Stellar ecosystem
- The contract uses `transfer()` (not `approve` + `transfer_from`), meaning the sender authorizes each transfer individually in their wallet
- `withdraw_deposits` transfers the **entire** deposit token balance — any tokens sent directly to the contract (not through `contribute`) would be swept up too

### Edge cases the contract handles

| Scenario | Behavior |
|----------|----------|
| Admin funds more tokens than the cap | Excess stays in the contract (no automatic recovery) |
| Someone sends tokens directly to the contract | Deposit tokens are swept by `withdraw_deposits`; sale tokens are stuck (no recovery) |
| Invalid address passed as argument | Soroban host validates addresses — simulation fails at the RPC level |
| Investor tries to claim during cliff period | `compute_available` returns 0 → `NothingToClaim` error |
| Two investors claim in the same block | Each claim is independent — no race condition |
| Admin cancels during the sale window | `contribute` immediately reverts with `Cancelled`; investors refund |

### Known limitations

- No whitelist — any address can contribute
- No per-address max — one investor can buy the entire cap
- No batch claim — each investor must call `claim` individually
- Partial refunds not supported — cancellation refunds the full contribution

---

## Roadmap

| Feature | Status | Priority |
|---------|--------|----------|
| Vesting schedule chart in frontend | 🟡 Planned | Low |
| Per-address contribution limit | 🔴 Not started | Medium |
| Whitelist / allowlist | 🔴 Not started | Medium |
| Multiple sale rounds (seed, public) | 🔴 Not started | Low |
| Referral tracking | 🔴 Not started | Low |
| Support for classic Stellar assets (non-Soroban) | 🔴 Not started | Low |

---

## Configuration Reference

### Frontend (`.env`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_RPC_URL` | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint |
| `VITE_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` | Network passphrase for signing |
| `VITE_CONTRACT_ID` | — | Deployed contract ID to load on startup |

### Scripts (environment)

| Variable | Default | Purpose |
|----------|---------|---------|
| `SOURCE` | `default` | Stellar identity or secret key |
| `STELLAR_NETWORK` | `testnet` | Network name |
| `RPC_URL` | `https://soroban-testnet.stellar.org` | RPC endpoint |
| `NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` | Network passphrase |

---

## Troubleshooting

<details>
<summary><strong>"not initialized" on every call</strong></summary>

You haven't called `initialize` yet. Every state-changing function requires initialization first.

```
./scripts/manage.sh initialize ...
```
</details>

<details>
<summary><strong>"sale not active" on contribute</strong></summary>

Check the current time vs. your `start` and `end` timestamps:

```
./scripts/manage.sh info
# → start: 1730000000, end: 1730086400
date +%s  # compare
```
</details>

<details>
<summary><strong>"cap reached"</strong></summary>

The sale is full. Deploy a new launchpad with a higher cap.
</details>

<details>
<summary><strong>Freighter doesn't pop up</strong></summary>

- Is Freighter installed and unlocked?
- Are you on the correct network (testnet vs mainnet)?
- Check the browser console — any errors?
- Try refreshing the page
</details>

<details>
<summary><strong>Transaction fails — "insufficient funds"</strong></summary>

The caller needs:
1. XLM for the transaction fee (~0.001 XLM per Soroban call)
2. Enough deposit tokens (with auth approved by signing)
</details>

<details>
<summary><strong>"below soft cap" on withdraw</strong></summary>

Not enough investors participated. Options:
- Wait for more contributions
- Cancel the sale so investors can refund
</details>

<details>
<summary><strong>WASM build fails — wasm32 target missing</strong></summary>

```bash
rustup target add wasm32-unknown-unknown
```
</details>

<details>
<summary><strong>Frontend shows "No launchpad found"</strong></summary>

The contract ID is wrong or the contract hasn't been initialized. Check `VITE_CONTRACT_ID`.
</details>

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Smart contract | Rust + Soroban SDK 26 | WASM-compiled, no_std, minimal footprint |
| Frontend | React 19 + TypeScript 6 | Broad ecosystem, type safety |
| Styling | Tailwind CSS v4 | Utility-first, composable |
| Build | Vite 8 | Fast HMR, clean bundles |
| Wallet | Freighter | First-class Stellar wallet with `signTransaction` |
| Stellar SDK | `@stellar/stellar-sdk` v15 | Official SDK with Soroban client generation |
| Testing | `cargo test` + snapshots | 9 tests, golden-file assertions |
| CI | GitHub Actions | fmt → clippy → test → tsc → build |
| WASM size | 10,901 bytes | Optimized release profile (LTO, strip) |

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Development setup and workflow
- Code style guide
- Pull request checklist
- How to report issues

This project is governed by the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md).

---

## License

MIT. See [LICENSE](./LICENSE).

*Built on Stellar · Powered by Soroban · Open for everyone.*
