# Cheshire Terminal CLI

Command-line tools for **[Cheshire Terminal](https://cheshireterminal.ai)** — site auth, skills discovery, agent registry registration, and dual-rail forge prepare (via [`cheshire-terminal-agents`](https://www.npmjs.com/package/cheshire-terminal-agents)).

```
Default origin:  https://cheshireterminal.ai
Override:        CHESHIRE_SITE_URL
API key:         CHESHIRE_API_KEY  (ct_sk_… developer keys)
```

## Quick start

```bash
chmod +x cheshire-cli.sh clawd-cli.sh clawd-connect.sh

# Help + branding
./cheshire-cli.sh help

# Public discovery (live site)
./cheshire-cli.sh status
./cheshire-cli.sh skills
./cheshire-cli.sh agents
./cheshire-cli.sh registry

# User registration (SIWS challenge — no private key required for this step)
./cheshire-cli.sh register:user --wallet <YOUR_SOLANA_PUBKEY>

# After signing the challenge message with your wallet:
./cheshire-cli.sh login --wallet <pubkey> --signature <sig> --message '<exact challenge message>'

# Or wire a developer API key (holder-gated mint on the site)
export CHESHIRE_API_KEY=ct_sk_…
./cheshire-cli.sh set-key --api-key "$CHESHIRE_API_KEY"
./cheshire-cli.sh whoami

# Agent registration (dry-run prepare)
./cheshire-cli.sh register:agent --dry-run
./cheshire-cli.sh register:agent --confirm --name my-agent-slug

# Forge prepare hints (delegates to cheshire-terminal-agents)
./cheshire-cli.sh forge:prepare --file cheshire-registration.json
```

Compatibility wrappers (same engine):

```bash
./clawd-cli.sh status
./clawd-connect.sh skills:list
npx tsx clawd-register.ts --dry-run
node cheshire-register.mjs
```

## Commands

| Command | Purpose |
|--------|---------|
| `help` | Usage |
| `status` | Developer status + skills count + agent-registry health |
| `skills` / `skills:search <q>` | Skills catalog |
| `agents` | Browser agents catalog summary + registry |
| `registry` | `GET /api/agent-registry/status` |
| `connect` | Endpoint map + credential wiring |
| `register:user --wallet <pk>` | `GET /api/auth/challenge` — SIWS payload |
| `login --wallet --signature --message` | `POST /api/auth/verify` |
| `whoami` | Credential + principal status |
| `set-key --api-key ct_sk_…` | Persist API key (`~/.config/cheshire-terminal/credentials.json`) |
| `register:agent --dry-run` | Build `POST /api/agent-registry/register` payload |
| `register:agent --confirm` | Live public agent registry apply |
| `forge:prepare` | Dual-rail forge command hints (`cheshire-terminal-agents`) |

## Site APIs used

| Surface | Path |
|--------|------|
| Developer status | `GET /api/developer/status` |
| Skills | `GET /api/skills` |
| Auth challenge | `GET /api/auth/challenge?wallet=` |
| Auth verify | `POST /api/auth/verify` |
| Agent registry | `GET /api/agent-registry/status`, `POST /api/agent-registry/register` |
| Metaplex health | `GET /api/metaplex-agents/health` |
| Browser agents | `GET /api/clawd/browser-agents` |

## Registration JSON

Cheshire-branded ERC-8004-style registration documents (all services host **cheshireterminal.ai**):

- `cheshire-registration.json` — primary
- `clawd-registration.json` — compatibility name
- `solana-clawd-registration.json` — short identity services list
- `cheshire-config.json` / `clawd-openclaw-config.json` — CLI defaults

## Dual-rail forge (package)

Heavy identity work (Robinhood ERC-8004 + Solana Metaplex + zk-omni) is **not** reimplemented here. Use:

```bash
npm i -g cheshire-terminal-agents
# or: npx cheshire-terminal-agents …

export CHESHIRE_SITE_URL=https://cheshireterminal.ai
export CHESHIRE_API_KEY=ct_sk_…   # optional hosted access

npx cheshire-terminal-agents agents-list
npx cheshire-terminal-agents prepare-local-robinhood --file cheshire-registration.json --chain 46630
npx cheshire-terminal-agents omni-mint-plan --file agent.json --chain 46630 --solana-network solana-devnet
```

See [robinhood-agents/README.md](../robinhood-agents/README.md) and npm [`cheshire-terminal-agents`](https://www.npmjs.com/package/cheshire-terminal-agents).

## Tests

```bash
node --test cli/cheshire-cli.test.mjs
# from repo root:
node --test ./cli/cheshire-cli.test.mjs
```

## Layout

```
cli/
  cheshire-cli.mjs       # Node entry
  cheshire-cli.sh        # Shell entry
  clawd-cli.sh           # Compat wrapper
  clawd-connect.sh       # Compat connect wrapper
  cheshire-register.mjs  # Register-focused entry
  clawd-register.ts      # TS spawn → cheshire-cli
  src/config.mjs         # URL + credentials
  src/client.mjs         # HTTP client
  src/commands.mjs       # Command implementations
  cheshire-cli.test.mjs  # node:test suite
  *.json                 # Registration / config fixtures
```

## License

MIT — see repo root license.
