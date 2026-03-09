# kraken-cli

Unofficial CLI for [Kraken](https://www.kraken.com) cryptocurrency exchange.

## Setup

1. Create an API key at https://www.kraken.com/u/security/api
2. Required permissions: Query Funds, Query Open Orders & Trades, Query Closed Orders & Trades, Query Ledger Entries, Create & Modify Orders

```bash
kraken login
```

## Commands

| Command | Description |
|---|---|
| `kraken login` | Save API credentials to OS keychain |
| `kraken logout` | Remove credentials from keychain |
| `kraken whoami` | Verify credentials and show exchange status |
| `kraken balances` | Show non-zero asset balances |
| `kraken orders` | List open orders |
| `kraken history` | Show closed order history |
| `kraken order` | Place an order (interactive or via flags) |
| `kraken funding` | Show deposit and withdrawal history |

## Usage

```bash
kraken balances
kraken orders
kraken history --pair XBTUSD --limit 10
kraken order --pair XBTUSD --side buy --type market --amount 0.001
kraken order --pair XBTUSD --side buy --type limit --amount 0.001 --price 50000 --yes
kraken funding --type deposit
kraken balances --json | jq .
```
