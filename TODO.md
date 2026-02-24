# TODO

## Next steps

- [ ] Fix statements command — currently returns 404, endpoint path likely wrong
- [x] Implement `send` command — full transfer flow (quote → transfer-requirements → transfer → payment with SCA)
- [ ] Implement `recipients` command — list saved recipients
- [ ] Implement `recipient` command — get/create recipient details
- [ ] Add `--yes` flag to `move` — skip confirmation prompt for scripted use (send already has it)

## Code quality

- [ ] Consolidate `wiseGet`/`wisePost` into a single `wiseRequest` function
- [ ] Extract `runCommand` wrapper to deduplicate try/catch/exit in all commands
- [ ] Add response types for API calls (replace `any` returns)
- [ ] Split `auth.ts` — extract `prompt()` and `login()` into separate modules
- [ ] Make validators throw instead of `process.exit` (enables unit testing)
- [ ] Add tests for validators, SCA functions, and commands
