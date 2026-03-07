# wise-cli

Unofficial CLI for Wise (TransferWise). Authenticates via browser-based 2FA; session is persisted at `~/.wise-cli/`.

## Installation

Requires [Bun](https://bun.sh).

```bash
git clone https://github.com/tiagogm/finclis
cd finclis
bun install
bun run --cwd packages/wise wise --help
```

## Commands

| Command | Description | Flags |
|---|---|---|
| `login` | Authenticate via browser | `--ttl <minutes>` |
| `logout` | Invalidate session | |
| `whoami` | Show account info + session expiry | `--json` |
| `profiles` | List personal and business profiles | `--json` |
| `balances` | Show all balances | `--json` |
| `activities` | Browse activities with pagination | `--month`, `--from/--to`, `--status`, `--type`, `--json` |
| `statements` | Account statement for a currency | `--currency`, `--from`, `--to`, `--json` |
| `contacts` | Browse contacts (interactive) | |
| `recipients` | Browse saved recipients (interactive) | |
| `rates <src> <tgt>` | Live exchange rate | `--json` |
| `transfer <id>` | Transfer details by ID | `--json` |
| `transfers` | List recent transfers | `--json` |
| `move` | Convert/move between balances | `--from`, `--to`, `--amount` |
| `send <amount> <currency>` | Send to a recipient | `--to`, `--reference`, `--yes` |

## Global flags

| Flag | Description |
|---|---|
| `-v, --verbose` | Log HTTP requests |
| `--json` | Output raw API JSON (exit 0=success, 1=error, 2=auth) |
