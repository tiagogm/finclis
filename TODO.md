# TODO

## Next steps

- [ ] Test logout flow — verify token invalidation works via API
- [ ] Fix statements command — currently returns 404, endpoint path likely wrong
- [ ] Implement `send` command — full transfer flow (quote → transfer-requirements → transfer → payment with SCA)
- [ ] Implement `recipients` command — list saved recipients
- [ ] Implement `recipient` command — get/create recipient details
- [ ] Add `--confirm` flag to `move` and `send` — require explicit confirmation before moving real money
- [ ] Token refresh — detect expired tokens and prompt re-login
- [ ] Better error messages — parse Wise API errors into human-readable output
