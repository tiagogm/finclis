# trading212-cli

Unofficial CLI for the [Trading212](https://trading212.com) REST API.

## Setup

```sh
cd packages/trading212
bun run trading212 auth set
```

You will be prompted for:
- **API key** — generate one in Trading212 → Settings → API
- **API secret**
- **Environment** — `live` (default) or `demo`

Credentials are stored in the OS keychain (macOS Keychain, Linux libsecret, Windows Credential Manager).

Alternatively, set env vars to skip the keychain (useful in CI):
```sh
export TRADING212_API_KEY=your-key
export TRADING212_API_SECRET=your-secret
export TRADING212_ENV=live   # optional, defaults to live
```

## Commands

| Command | Description |
|---|---|
| `trading212 auth set` | Store API credentials in keychain |
| `trading212 auth view` | Show stored credentials |
| `trading212 auth clear` | Remove stored credentials |
| `trading212 whoami` | Show account ID and currency |
| `trading212 cash` | Free, invested, P&L, total cash |
| `trading212 positions` | Open portfolio positions |
| `trading212 orders` | Pending orders |
| `trading212 history orders` | Historical filled/cancelled orders |
| `trading212 history dividends` | Dividend payment history |
| `trading212 history transactions` | Cash movements |
| `trading212 instruments` | Tradable instruments (filterable) |

All data commands accept `--json` to output raw JSON and `-v` / `--verbose` to log HTTP requests.

```sh
trading212 instruments --search AAPL
trading212 cash --json
trading212 history dividends --json | jq '.[] | .amount'
```

## Development

```sh
bun run typecheck   # Type-check without compiling
bun run compile     # Build standalone binaries to dist/
```
