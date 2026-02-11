#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SEARCH_DIRS=()
[[ -d "$ROOT_DIR/src" ]] && SEARCH_DIRS+=("$ROOT_DIR/src")
[[ -d "$ROOT_DIR/api" ]] && SEARCH_DIRS+=("$ROOT_DIR/api")

if [[ ${#SEARCH_DIRS[@]} -eq 0 ]]; then
  echo "[secret-guard] No src/api directories found. Skipping."
  exit 0
fi

GREP_EXCLUDES=(
  "--exclude-dir=node_modules"
  "--exclude-dir=.next"
  "--exclude-dir=.vercel"
  "--exclude-dir=dist"
  "--exclude-dir=coverage"
  "--exclude-dir=test-results"
  "--exclude-dir=__tests__"
  "--exclude-dir=e2e"
  "--exclude=*.map"
  "--exclude=*.test.*"
  "--exclude=*.spec.*"
)

FORBIDDEN_PATTERNS=(
  "process.env.CLOUT_API_KEY"
  "process.env.CLOUT_INTERNAL_API_KEY"
  "process.env.NEXT_PUBLIC_CLOUT_API_KEY"
  "process.env.VITE_CLOUT_API_KEY"
  "x-api-key"
)

found=0
for needle in "${FORBIDDEN_PATTERNS[@]}"; do
  matches="$(grep -RIn "${GREP_EXCLUDES[@]}" -- "${needle}" "${SEARCH_DIRS[@]}" 2>/dev/null || true)"
  if [[ -n "$matches" ]]; then
    echo "[secret-guard] Forbidden pattern found: ${needle}"
    echo "$matches"
    found=1
  fi
done

ENV_FILES=(
  ".env.example"
  ".env.local.example"
)

for rel in "${ENV_FILES[@]}"; do
  f="$ROOT_DIR/$rel"
  [[ -f "$f" ]] || continue
  envMatches="$(grep -nE '^(CLOUT_API_KEY|CLOUT_INTERNAL_API_KEY|NEXT_PUBLIC_CLOUT_API_KEY|VITE_CLOUT_API_KEY)=' "$f" 2>/dev/null || true)"
  if [[ -n "$envMatches" ]]; then
    echo "[secret-guard] Forbidden env key found in ${rel}"
    echo "$envMatches"
    found=1
  fi
done

if [[ "$found" -ne 0 ]]; then
  echo "[secret-guard] Fail: static shared secret keys reintroduced. Use Vercel OIDC service auth instead."
  exit 1
fi

echo "[secret-guard] OK"

