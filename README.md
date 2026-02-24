# wise-cli

Unofficial CLI for Wise (TransferWise). Authenticates via the Wise web login flow (email + 2FA) to access SCA-protected endpoints that the personal API token can't reach.

## Setup

```bash
npm install
npm run build
```

Optionally add a shell alias:

```bash
alias wise="node /path/to/wise-cli/dist/index.js"
```

## Usage

```bash
# Authenticate (opens browser)
wise login

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

## How it works

Login opens a real Chromium browser via Playwright so you can complete email + 2FA normally. The CLI captures the OAuth token from the browser session and stores it at `~/.wise-cli/session.json`. All subsequent commands use this token to call the Wise API.

## Commands

| Command | Description |
|---------|-------------|
| `login` | Authenticate via browser (email + 2FA) |
| `logout` | Log out and invalidate session |
| `profiles` | List personal and business profiles |
| `balances` | Show all balances (standard + savings) |
| `statements` | Get account statement for a currency and date range |
| `rates` | Get live exchange rate between two currencies |
| `transfers` | List recent transfers |
| `move` | Convert between currencies or move between balances |

## Requirements

- Node.js 18+
- Playwright (installed automatically with `npm install`)
