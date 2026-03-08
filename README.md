# finclis

Unofficial CLIs for financial services. Each package is independently compiled and distributed.

## Packages

| Package | Command | Description | Auth |
|---|---|---|---|
| [monzo-cli](packages/monzo/README.md) | `monzo` | Unofficial CLI for Monzo | OAuth2 |
| [trading212-cli](packages/trading212/README.md) | `trading212` | Unofficial CLI for Trading212 | API key |
| [wise-cli](packages/wise/README.md) | `wise` | Unofficial CLI for Wise (TransferWise) | Browser |
| [vanguard-cli](packages/vanguard/README.md) | `vanguard` | Unofficial CLI for Vanguard Investor UK | Browser |

## Installation

### From source

Requires [Bun](https://bun.sh).

```bash
git clone https://github.com/tiagogm/finclis
cd finclis
bun install
```

### Prebuilt binaries

Standalone binaries (no Bun required) are published for each release on [GitHub Releases](https://github.com/tiagogm/finclis/releases). Download the binary for your platform and put it on your `PATH`.

See each package README for usage.

## Authorization

| Method | How it works | Credentials stored |
|---|---|---|
| OAuth2 | Run `auth set` to store client credentials, then `login` to complete the OAuth2 flow in the browser and fetch an access token | OS keychain via `Bun.secrets` |
| API key | Run `auth set` to enter your API key; key is stored immediately — no login step needed | OS keychain via `Bun.secrets` |
| Browser | Run `login` — Chromium opens the service login page; email, password, and 2FA are completed directly in the CLI-controlled browser window. Session cookies are saved locally and reused for all subsequent requests | `~/.<cli>-cli/session.json` |

## Development

```bash
bun install          # install all workspace dependencies
bun run test         # test all packages
bun run compile      # compile all packages to binaries
```

## Adding a new CLI

1. Create `packages/<name>/`
2. Add `package.json`, `src/index.ts`, entry script, `tsconfig.json`
3. Copy the `compile` script pattern from `packages/wise/package.json`
4. Add a release workflow at `.github/workflows/release-<name>.yml`
