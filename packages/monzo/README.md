# monzo-cli

Unofficial CLI for the Monzo API. OAuth2 authentication, session stored in OS Keychain via `Bun.secrets`.

## Setup

Requires [Bun](https://bun.sh) >= 1.2.21.

1. Create an OAuth client at https://developers.monzo.com
   - Set **Redirect URL** to `http://localhost:3000/callback`
   - Note your `client_id` and `client_secret`

2. Install dependencies:
   ```bash
   bun install
   ```

3. Login:
   ```bash
   bun run monzo login
   ```
   The CLI will prompt for credentials (or read `MONZO_CLIENT_ID` / `MONZO_CLIENT_SECRET` from env), open the browser, and wait for Monzo app approval.

## Commands

### Auth
```
monzo auth view                             Show stored credentials
monzo auth set                              Set client_id and client_secret
monzo auth clear                            Remove stored credentials
monzo login [-v]                            Authenticate via OAuth2
monzo logout                                Revoke token and clear session
```

### Account info
```
monzo whoami [--json] [-v]                  Show authenticated user
monzo accounts list [--json] [-v]           List all accounts
monzo accounts set [accountId] [-v]         Switch active account
monzo balance [--json] [-v]                 Show account balance
```

### Pots
```
monzo pots [--json] [-v]                    List pots
monzo pots deposit <potId> <amount> [--yes] Deposit into a pot (amount in GBP)
monzo pots withdraw <potId> <amount> [--yes] Withdraw from a pot
```

### Transactions
```
monzo transactions [--month MM-YYYY] [--from YYYY-MM-DD] [--to YYYY-MM-DD]
                   [--limit N] [--sync] [--json] [-v]
monzo summary [--month MM-YYYY] [--json] [-v]  Monthly category breakdown
```

### Flags
- `--json` — raw JSON output (all read commands)
- `-v, --verbose` — log HTTP requests to stderr
- `--yes` — skip confirmation prompts (write commands)

## Transaction sync

Monzo restricts API access to the last 90 days. To access older data, sync after login:

```bash
monzo transactions --sync                    # sync last 12 months
monzo transactions --sync --from 2024-01-01  # sync from specific date
```

Synced data is cached at `~/.monzo-cli/cache/` and used automatically for older date ranges.

## Session storage

Sessions are stored in the OS credential store (macOS Keychain, Linux libsecret, Windows Credential Manager) via `Bun.secrets` — no plain text files on disk.
