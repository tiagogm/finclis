# vanguard-cli

Unofficial CLI for Vanguard Investor UK. Authenticates via browser-based auth (email + 2FA); session is persisted at `~/.vanguard-cli/`.

## Installation

Requires [Bun](https://bun.sh).

```bash
git clone https://github.com/tiagogm/finclis
cd finclis
bun install
bunx playwright install chromium   # required for browser-based login
bun run --cwd packages/vanguard vanguard --help
```

## Commands

| Command | Description | Flags |
|---|---|---|
| `login` | Authenticate via browser (email + 2FA) | `--ttl <minutes>` |
| `logout` | Invalidate session | |
| `whoami` | Session check + portfolio value | `--json` |
| `balance` | Total, invested, and cash balances | `--json` |
| `holdings` | Portfolio holdings breakdown | `--json` |
| `performance` | Lifetime cumulative return | `--json` |
| `summary` | Monthly investment summary | `--month MM-YYYY`, `--year YYYY`, `--from/--to YYYY-MM-DD`, `--json` |

## Global flags

| Flag | Description |
|---|---|
| `-v, --verbose` | Log HTTP requests |
| `--json` | Output raw API JSON |
