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

# People
wise contacts              # browse recent contacts, search by name/tag
wise recipients            # browse bank recipients, search by name/currency

# Exchange rates
wise rates EUR GBP

# Transfers
wise transfers             # list recent transfers
wise transfer 1988732492   # get transfer details by ID

# Send money (interactive contact picker + SCA)
wise send 100 GBP                          # pick contact interactively
wise send 100 GBP --to 371502272           # send to specific recipient ID
wise send 100 EUR --target-currency GBP    # cross-currency send
wise send 50 GBP --to 371502272 --yes -v   # skip confirmation, verbose

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
| `contacts` | Browse and search Wise contacts (recent + search) |
| `recipients` | Browse and search saved bank recipients |
| `rates` | Get live exchange rate between two currencies |
| `transfer` | Get transfer details by ID |
| `transfers` | List recent transfers (with IDs) |
| `move` | Convert between currencies or move between balances |
| `send` | Send money to a contact or recipient (quote → transfer → fund) |

## How it works

Login opens a real Chromium browser via Playwright so you can complete email + 2FA normally. The CLI captures the OAuth token from the browser session and stores it at `~/.wise-cli/session.json` (mode 0600, directory mode 0700). All subsequent commands use this token to call the Wise API.

Sessions expire after 1 hour by default. Set a custom TTL with `wise login --ttl 120` (in minutes). Logout revokes the token server-side, clears the session file, and removes auth cookies from the browser profile (Turnstile/device trust is preserved for smoother re-login).

## Security

- **Token storage:** OAuth token stored in `~/.wise-cli/session.json` with 0600 permissions. The file is plaintext — any process running as your user can read it.
- **Session expiry:** Client-side TTL (default 1 hour). The server may keep the token valid longer. Run `wise logout` to revoke server-side.
- **Browser profile:** Persistent Chromium profile at `~/.wise-cli/browser-profile/` preserves device trust. Auth cookies are cleared on logout.
- **SCA:** Sensitive operations (e.g. sends, money moves) trigger Wise's Strong Customer Authentication. The CLI handles multiple challenge rounds (PASSWORD, SMS, WhatsApp, voice call, PIN) — you'll be prompted in the terminal.
- **Token interception:** During login, the CLI only captures tokens from `wise.com` and `api.wise.com` responses.

## Development

```bash
bun install         # install dependencies
bun test            # run tests
bun run typecheck   # type check with tsc
```
