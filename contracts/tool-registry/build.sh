#!/usr/bin/env bash
# Build the ToolRegistry contract to a wasm Casper's interpreter will accept.
#
# Two non-obvious steps, both learned by paying for failed installs:
#
#  1. build-std: the precompiled core/alloc for wasm32-unknown-unknown are
#     built with bulk-memory, so disabling the target feature for our crate
#     alone changes nothing.
#  2. wasm-opt lowering: even then LLVM emits memory.copy/memory.fill. Casper
#     rejects the module at preprocessing with "Bulk memory operations are not
#     supported", AFTER charging the full declared gas.
#
# Verify with:  wasm-opt out.wasm --print -o /dev/null | grep -c memory.copy
# It must print 0, matching Odra's proxy_caller wasm which the node accepts.
set -euo pipefail
cd "$(dirname "$0")"

RAW=target/wasm32-unknown-unknown/release/tool_registry.wasm
OUT=target/tool_registry.mvp.wasm

cargo +nightly-2025-07-01 build --release --target wasm32-unknown-unknown \
  -Z build-std=core,alloc,panic_abort \
  -Z build-std-features=panic_immediate_abort

wasm-opt "$RAW" -o "$OUT" \
  --enable-bulk-memory --enable-sign-ext \
  --llvm-memory-copy-fill-lowering --signext-lowering \
  -Oz

left=$(wasm-opt "$OUT" --print -o /dev/null 2>/dev/null \
  | grep -cE 'memory\.copy|memory\.fill|memory\.init|data\.drop' || true)
if [ "$left" != "0" ]; then
  echo "✗ $left bulk-memory ops remain; the node will reject this and keep the gas." >&2
  exit 1
fi
echo "✓ $OUT  ($(wc -c < "$OUT" | tr -d ' ') bytes, MVP-clean)"
