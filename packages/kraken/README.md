# kraken-cli

Unofficial CLI for [Kraken](https://www.kraken.com) cryptocurrency exchange.

## Setup

1. Create an API key at https://www.kraken.com/u/security/api
2. Required permissions: Query Funds, Query Open Orders & Trades, Query Closed Orders & Trades, Query Ledger Entries, Create & Modify Orders
3. Run: `kraken auth set`

## Commands

| Command | Description |
|---|---|
| `kraken auth set/view/clear` | Manage API credentials in OS keychain |
| `kraken whoami` | Verify credentials and show exchange status |
| `kraken balances` | Show non-zero balances (optionally with `--rates <currency>`) |
| `kraken orders open` | List open orders |
| `kraken orders history` | Paginated closed order history (supports `--month`) |
| `kraken orders place` | Place an order (interactive or via flags) |
| `kraken funding history` | Deposit and withdrawal history (supports `--month`) |

## 2FA / OTP

If your API key requires 2FA, pass `--otp <code>` as a global flag,
or set the `KRAKEN_OTP` env var, or kraken will prompt interactively and cache the code.

## Usage examples

```bash
kraken auth set
kraken balances --rates GBP
kraken orders history --month 2026-01
kraken orders history --month            # current month
kraken funding history --month 2026-02
kraken orders place --pair XBTUSD --side buy --type market --amount 0.001 --yes
kraken balances --json | jq .
```
