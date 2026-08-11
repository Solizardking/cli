#!/usr/bin/env bash
# Compatibility wrapper — OpenClawd/clawd-cli names redirect to Cheshire Terminal CLI.
# Primary brand: Cheshire Terminal · https://cheshireterminal.ai
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export CHESHIRE_SITE_URL="${CHESHIRE_SITE_URL:-https://cheshireterminal.ai}"
export SOLANA_CLAWD_SITE_URL="${SOLANA_CLAWD_SITE_URL:-https://solanaclawd.com}"

# Map legacy command aliases to Cheshire commands where needed
CMD="${1:-help}"
shift || true

case "$CMD" in
  skills:list)   exec "$ROOT/cheshire-cli.sh" skills "$@" ;;
  skills:store|skills-store|skills:store:list)
    exec "$ROOT/cheshire-cli.sh" skills:store "$@"
    ;;
  skills:publish|skills:upload|skills:list-on-store)
    exec "$ROOT/cheshire-cli.sh" skills:publish "$@"
    ;;
  skills:validate|skills:scan)
    exec "$ROOT/cheshire-cli.sh" skills:validate "$@"
    ;;
  skills:mine|skills:listed)
    exec "$ROOT/cheshire-cli.sh" skills:mine "$@"
    ;;
  skills:featured)
    exec "$ROOT/cheshire-cli.sh" skills "$@"
    ;;
  skills:install)
    echo "Install skills via: curl -sS \"\${CHESHIRE_SITE_URL}/api/skills/${1:-SLUG}/download\" -o SKILL.md" >&2
    echo "Or browse: \${CHESHIRE_SITE_URL}/api/skills" >&2
    exec "$ROOT/cheshire-cli.sh" skills "$@"
    ;;
  marketplace|marketplace:trending|marketplace:new)
    exec "$ROOT/cheshire-cli.sh" skills "$@"
    ;;
  register)
    # Prefer agent register prepare; user auth is register:user
    if [[ "${1:-}" == "--user" ]] || [[ "${1:-}" == "user" ]]; then
      shift || true
      exec "$ROOT/cheshire-cli.sh" register:user "$@"
    fi
    exec "$ROOT/cheshire-cli.sh" register:agent --dry-run "$@"
    ;;
  node|node:register|node:status|node:peers)
    echo "Node ops: use Cheshire connect + agent registry." >&2
    exec "$ROOT/cheshire-cli.sh" connect "$@"
    ;;
  wallet|wallet:status|wallet:create|wallet:address|wallet:balance|wallet:slot|wallet:policy|wallet:hubs)
    # Agentic wallet (local non-custodial) — dual hubs: cheshireterminal.ai/cli + solanaclawd.com/cli
    export SOLANA_CLAWD_SITE_URL="${SOLANA_CLAWD_SITE_URL:-https://solanaclawd.com}"
    if [[ "$CMD" == "wallet" ]]; then
      exec "$ROOT/cheshire-cli.sh" wallet:status "$@"
    fi
    exec "$ROOT/cheshire-cli.sh" "$CMD" "$@"
    ;;
  prices|trading|swap)
    echo "Trading: use agentic wallet + site hubs:" >&2
    echo "  ${CHESHIRE_SITE_URL}/cli  ·  ${SOLANA_CLAWD_SITE_URL:-https://solanaclawd.com}/cli" >&2
    echo "  cheshire-cli wallet:status | wallet:balance | wallet:policy" >&2
    exec "$ROOT/cheshire-cli.sh" wallet:status "$@"
    ;;
  payment:supported|payment:verify|payment:settle)
    echo "x402 gateway: ${CHESHIRE_SITE_URL}/x402" >&2
    exec "$ROOT/cheshire-cli.sh" connect "$@"
    ;;
  attest:*|attest)
    echo "Attestation stubs removed — use cheshire-terminal-agents forge + Metaplex APIs on cheshireterminal.ai" >&2
    exec "$ROOT/cheshire-cli.sh" forge:prepare "$@"
    ;;
  *)
    exec "$ROOT/cheshire-cli.sh" "$CMD" "$@"
    ;;
esac
