# finclis

'Unofficial' CLIs for popular financial platforms. Each package is independently compiled and distributed.

## Motivation
Part of a set a of tools to automate my personal finances and to play around with claude.

This CLIs are meant to be used with other tools and agents to query, render data and execute instructions

Code is 100% produced by Claude and partly human reviewed


## Packages

| Package | Command | Description | Auth |
|---|---|---|---|
| [monzo-cli](packages/monzo/README.md) | `monzo` | Unofficial CLI for Monzo | OAuth2 |
| [trading212-cli](packages/trading212/README.md) | `trading212` | Unofficial CLI for Trading212 | API key |
| [wise-cli](packages/wise/README.md) | `wise` | Unofficial CLI for Wise (TransferWise) | Browser |
| [vanguard-cli](packages/vanguard/README.md) | `vanguard` | Unofficial CLI for Vanguard Investor UK | Browser |
| [kraken-cli](packages/kraken/README.md) | `kraken` | Unofficial CLI for Kraken cryptocurrency exchange | API key |

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

## Keychain credentials

OAuth2 and API key CLIs store credentials in the OS keychain via [Bun.secrets](https://bun.com/docs/runtime/secrets), namespaced per service. Nothing is written to disk in plaintext.

```bash
<cli> auth view   # show stored credentials
<cli> auth clear  # remove credentials from keychain
<cli> logout      # (OAuth2 + Browser) revoke token server-side + clear local session
```

## Browser sessions

Browser CLIs save session state to `~/.<cli>-cli/session.json` (mode `0600`) after login. The file holds the token or cookies needed to make authenticated requests without re-opening the browser.

Sessions have two expiry mechanisms:

- **TTL** — a local timeout (default 60 min, override with `--ttl <minutes>` on `login`). Checked before every request.
- **Server-side / idle expiry** — the service may invalidate the session independently (e.g. after inactivity or a server-side logout). The local file won't reflect this until a request fails.

There is no automatic refresh for either expiry type.

```bash
<cli> logout  # revokes token server-side, clears auth cookies, deletes session.json
```

To remove the session file manually:

```bash
rm ~/.<cli>-cli/session.json
```

## Checking session status

All CLIs provide a `whoami` command that makes a live request to verify the current session is still valid:

```bash
<cli> whoami  # prints account info, or errors if the session has expired or is invalid
```

Use this to check any auth method — keychain token, API key, or browser session.

## Browser profile and device trust

Each browser CLI keeps a persistent Chromium profile at `~/.<cli>-cli/browser-profile` to preserve device-trust cookies, so 2FA is not triggered on every login. `logout` clears auth cookies and localStorage but leaves the profile intact.

Delete the profile only if you want a full reset — expect 2FA on next login:

```bash
rm -rf ~/.<cli>-cli/browser-profile
#example: rm -rf ~/.lloyds-cli/browser-profile
```

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
