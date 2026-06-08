#!/usr/bin/env bash
# Regenerate TypeScript contract bindings from compiled WASM.
# Requires: stellar CLI, wasm target built.
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
WASM="$DIR/contracts/token_launchpad/target/wasm32v1-none/release/token_launchpad.wasm"
OUT="$DIR/frontend/src/contract"

if [ ! -f "$WASM" ]; then
  echo "WASM not found. Build first:"
  echo "  cargo build --target wasm32v1-none --release"
  exit 1
fi

echo "Regenerating TypeScript bindings..."
stellar contract bindings typescript \
  --wasm "$WASM" \
  --output-dir "$OUT" \
  --contract-id "${1:-}" 2>/dev/null || {
  echo "Failed. Is stellar CLI installed?"
  echo "  cargo install soroban-cli --features opt"
  exit 1
}

echo "Bindings generated at $OUT/src/index.ts"
echo "Note: If regenerating, manually convert the 'enum' to a 'const' object"
echo "for TypeScript 6.0 'erasableSyntaxOnly' compatibility (see existing file)."
