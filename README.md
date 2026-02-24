# wise-cli

Unofficial CLI for Wise (TransferWise). Authenticates via the Wise web login flow (email + 2FA) to access SCA-protected endpoints that the personal API token can't reach.

## Requirements

- [Bun](https://bun.sh) 1.0+
- Node.js 22+ (for Playwright)

## Install

```bash
git clone <repo-url> ~/Projects/wise-cli
cd ~/Projects/wise-cli
bun install
```

To use `wise` as a command from anywhere, add to your `~/.zshrc`:

```bash
alias wise="bun /Users/$(whoami)/Projects/wise-cli/wise"
```

Then `source ~/.zshrc` or open a new terminal.

## Usage

```bash
# Authenticate (opens browser for email + 2FA)
wise login

# Check session
wise whoami

# Account info
wise profiles
wise balances
wise statements --currency GBP --from 2025-01-01 --to 2025-01-31

# Exchange rates
wise rates EUR GBP

# Transfers
wise transfers

# Convert between currencies
wise move --from EUR --to GBP --amount 100

# Move between same-currency balances (e.g. standard → savings)
wise move --from EUR --to EUR --amount 50 --source-balance 123 --target-balance 456

# Log out
wise logout
```

## Commands

| Command | Description |
|---------|-------------|
| `login` | Authenticate via browser (email + 2FA) |
| `logout` | Log out and invalidate session |
| `whoami` | Check session validity and show account info |
| `profiles` | List personal and business profiles |
| `balances` | Show all balances (standard + savings) |
| `statements` | Get account statement for a currency and date range |
| `rates` | Get live exchange rate between two currencies |
| `transfers` | List recent transfers |
| `move` | Convert between currencies or move between balances |

## How it works

Login opens a real Chromium browser via Playwright so you can complete email + 2FA normally. The CLI captures the OAuth token from the browser session and stores it at `~/.wise-cli/session.json` (mode 0600, directory mode 0700). All subsequent commands use this token to call the Wise API. Sessions expire after 12 hours.

## Development

```bash
bun install         # install dependencies
bun test            # run tests
bun run typecheck   # type check with tsc
```
