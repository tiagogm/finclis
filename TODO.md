# TODO

## Next steps

- [ ] Fix statements command — currently returns 404, endpoint path likely wrong
- [x] Implement `send` command — full transfer flow (quote → transfer-requirements → transfer → payment with SCA)
- [x] Implement `contacts` command — browse and search Wise contacts
- [x] Implement `recipients` command — browse and search saved bank recipients
- [x] Implement `transfer` command — get transfer details by ID
- [ ] Add `--yes` flag to `move` — skip confirmation prompt for scripted use (send already has it)
- [ ] Add `-v` flag to `move` — verbose HTTP logging (send already has it)

## Code quality

- [ ] Extract shared `shortName()` and `printSummary()` into a display utility
- [ ] Extract shared contact fetching/parsing between `send.ts` and `contacts.ts`
- [ ] Consolidate `wiseGet`/`wisePost` into a single `wiseRequest` function
- [ ] Extract `runCommand` wrapper to deduplicate try/catch/exit in all commands
- [ ] Add response types for API calls (replace `any` returns)
- [ ] Split `auth.ts` — extract `prompt()` and `login()` into separate modules
- [ ] Make validators throw instead of `process.exit` (enables unit testing)
- [ ] Add tests for validators, SCA functions, and commands
