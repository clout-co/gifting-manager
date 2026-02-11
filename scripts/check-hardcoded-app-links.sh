#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SEARCH_DIRS=()
[[ -d "$ROOT_DIR/src" ]] && SEARCH_DIRS+=("$ROOT_DIR/src")
[[ -d "$ROOT_DIR/api" ]] && SEARCH_DIRS+=("$ROOT_DIR/api")

if [[ ${#SEARCH_DIRS[@]} -eq 0 ]]; then
  echo "[link-guard] No src/api directories found. Skipping."
  exit 0
fi

# Drift prevention: child apps must not hardcode other app production URLs.
FORBIDDEN=(
  "gifting-app-seven.vercel.app"
  "shorts-os-bi.vercel.app"
  "model-crm-app.vercel.app"
  "product-master-neon.vercel.app"
  "sales-targets.vercel.app"
)

found=0
for needle in "${FORBIDDEN[@]}"; do
  # macOS (BSD) grep: no --color/--binary-files portability needed for this repo.
  matches="$(grep -RIn -- "${needle}" "${SEARCH_DIRS[@]}" 2>/dev/null || true)"
  if [[ -n "$matches" ]]; then
    echo "[link-guard] Forbidden hardcoded hostname found: ${needle}"
    echo "$matches"
    found=1
  fi
done

if [[ "$found" -ne 0 ]]; then
  echo "[link-guard] Fail: hardcoded production URLs detected. Use /api/master/apps from Clout Dashboard instead."
  exit 1
fi

echo "[link-guard] OK"

