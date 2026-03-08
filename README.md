# finclis

Unofficial CLIs for financial services. Each package is independently compiled and distributed.

## Packages

| Package | Command | Description |
|---|---|---|
| [wise-cli](packages/wise/README.md) | `wise` | Unofficial CLI for Wise (TransferWise) |
| [vanguard-cli](packages/vanguard/README.md) | `vanguard` | Unofficial CLI for Vanguard Investor UK |

## Installation

Requires [Bun](https://bun.sh).

```bash
git clone https://github.com/tiagogm/finclis
cd finclis
bun install
```

See each package README for usage.

## Architecture

Each CLI is a standalone TypeScript package built on [Bun](https://bun.sh) and [Playwright](https://playwright.dev).

### Authorization

All CLIs use the same browser-based auth pattern:

1. **Login** — Chromium opens the service's login page. The user completes the normal flow (email, password, 2FA) in the browser window. Automation-detection flags are disabled and a persistent browser profile is reused across logins so device trust and captcha cookies carry over between sessions.

2. **Token extraction** — Once the browser lands on the post-login dashboard, the CLI extracts whatever credentials the service exposes (Bearer tokens, cookies, XSRF tokens, account identifiers).

3. **Session file** — Credentials are written to `~/.<cli-name>/session.json` (mode `0600`, directory mode `0700`). The file includes a `createdAt` timestamp and configurable TTL (default 60 minutes). Expired sessions are rejected on load.

4. **API requests** — Commands read the session file and call the service APIs directly — no browser involved at runtime.

5. **Step-up auth** — Some write operations trigger a secondary authentication challenge from the service (e.g. SMS, password, PIN). The CLI handles these interactively in the terminal.

6. **Logout** — Revokes credentials server-side, clears auth cookies from the persistent browser profile (preserving device trust cookies), then deletes the session file.

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
