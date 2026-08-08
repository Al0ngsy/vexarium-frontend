#!/usr/bin/env bash
#
# VEXARIUM frontend — one-command deploy to Cloudflare Pages.
#
#   yarn deploy
#
# Builds with the production API URL, then uploads to Cloudflare Pages via
# wrangler (direct upload — the Pages project is not git-connected).
#
# Secrets are read from, in order of preference:
#   1. Environment variables (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID)
#   2. ../deploy-secrets.env  (the monorepo-layout secrets file, if present)
#   3. ./.env                 (a repo-local .env, if present)
#
# Overridable via env:
#   VITE_API_URL   default https://vexarium-api.onrender.com
#   CF_PROJECT     default vexarium
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# --- Load secrets -----------------------------------------------------------
# Prefer the monorepo-layout secrets file (../deploy-secrets.env), then a
# repo-local .env. Environment variables always win (set -a only sets vars
# that are NOT already exported).
for SECRETS in "$ROOT/../deploy-secrets.env" "$ROOT/.env"; do
  if [[ -f "$SECRETS" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$SECRETS"
    set +a
  fi
done

# --- Config ----------------------------------------------------------------
VITE_API_URL="${VITE_API_URL:-https://vexarium-api.onrender.com}"
CF_PROJECT="${CF_PROJECT:-vexarium}"
CF_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-6df45854487d44b5a40cf98b3309904e}"

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "ERROR: CLOUDFLARE_API_TOKEN not set (env, ../deploy-secrets.env, or ./.env)." >&2
  exit 1
fi

# --- Build -----------------------------------------------------------------
echo "==> Building frontend (VITE_API_URL=$VITE_API_URL)"
VITE_API_URL="$VITE_API_URL" yarn build

# --- Deploy ----------------------------------------------------------------
echo "==> Deploying to Cloudflare Pages ($CF_PROJECT)"
CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" \
CLOUDFLARE_ACCOUNT_ID="$CF_ACCOUNT_ID" \
  yarn wrangler pages deploy .svelte-kit/cloudflare --project-name="$CF_PROJECT" --branch=main --commit-dirty=true

echo "==> Live at https://$CF_PROJECT.pages.dev"
