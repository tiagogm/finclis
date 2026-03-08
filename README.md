# finclis

Unofficial CLIs for financial services. Each package is independently compiled and distributed.

## Packages

| Package | Command | Description | Auth |
|---|---|---|---|
| [monzo-cli](packages/monzo/README.md) | `monzo` | Unofficial CLI for Monzo | OAuth2 (browser approval) |
| [trading212-cli](packages/trading212/README.md) | `trading212` | Unofficial CLI for Trading212 | API key |
| [wise-cli](packages/wise/README.md) | `wise` | Unofficial CLI for Wise (TransferWise) | Browser-based 2FA |
| [vanguard-cli](packages/vanguard/README.md) | `vanguard` | Unofficial CLI for Vanguard Investor UK | Browser-based 2FA |

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

Each CLI uses a different auth method:

| CLI | Method | Credentials stored |
|---|---|---|
| `monzo` | OAuth2 — prompts for client credentials, opens browser for Monzo app approval | OS keychain (`Bun.secrets`) |
| `trading212` | API key — generate in Trading212 → Settings → API | OS keychain (`Bun.secrets`) |
| `wise` | Browser-based — Chromium opens Wise login page for email + 2FA | `~/.wise-cli/session.json` |
| `vanguard` | Browser-based — Chromium opens Vanguard login page for email + 2FA | `~/.vanguard-cli/session.json` |

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
