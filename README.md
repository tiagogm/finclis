# finclis

Unofficial CLIs for financial services. Each package is independently compiled and distributed.

## Packages

| Package | Command | Description |
|---|---|---|
| [wise-cli](packages/wise) | `wise` | Unofficial CLI for Wise (TransferWise) |

## Installation

Download the binary for your platform from [Releases](../../releases).

Place it in your `PATH` and run:

```
wise --help
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
