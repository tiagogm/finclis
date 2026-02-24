# Send Command Design

## Summary

Add a `send` command to wise-cli that handles the full transfer flow: quote creation, transfer requirements collection, transfer creation, and balance funding. Standard transfers only (POST /v1/transfers).

## Command Signature

```
wise send <amount> <currency> [options]

Options:
  --to <recipientId>          Recipient account ID (skips interactive picker)
  --from <balanceId>          Source balance ID (optional)
  --target-currency <code>    Target currency override (defaults to recipient's currency)
  --reference <text>          Payment reference text
  -v, --verbose               Log each HTTP request/response status
  --yes                       Skip confirmation prompt
```

**Examples:**
```
wise send 150 GBP
wise send 150 GBP --to 8692237
wise send 150 GBP --to 8692237 --from 69848388 -v
wise send 100 EUR --to 8692237 --target-currency GBP --reference "Invoice 42"
```

## Architecture

Single file: `src/commands/send.ts`. Follows existing command patterns. Verbose logging added to `src/client.ts` via module-level flag.

## Flow

1. Validate inputs (amount, currency)
2. If `--to` not provided: fetch recipients, present interactive picker
3. Create quote — `POST /v3/profiles/{id}/quotes`
4. Check transfer requirements — `POST /v1/transfer-requirements`
   - Prompt for required fields (select lists, text inputs)
   - Re-call if `refreshRequirementsOnChange` fields are set
   - Loop until all required fields satisfied
5. Show confirmation summary
6. Create transfer — `POST /v1/transfers` with `customerTransactionId` for idempotency
7. Fund transfer — `POST /v3/profiles/{id}/transfers/{id}/payments` with `type: "BALANCE"`
8. Print summary table

## Recipient Picker

When `--to` is omitted:
- Fetch: `GET /v2/accounts?profile={profileId}`
- Display numbered list with name, currency, and partial account details
- User types number to select
- Extract targetAccount ID

## Transfer Requirements

Dynamic form loop:
1. POST to `/v1/transfer-requirements` with current details
2. For each required field:
   - `type: "select"` — numbered list of `valuesAllowed`, prompt for selection
   - `type: "text"` — prompt with `minLength`/`maxLength`/`validationRegexp` enforcement
3. If any field has `refreshRequirementsOnChange: true`, re-POST with updated values
4. Repeat until complete

## Verbose Mode

Add to `client.ts`:
- Before request: `-> METHOD url`
- After response: `<- STATUS`
- Controlled by exported `setVerbose(enabled: boolean)` function

## Output

### Confirmation prompt (before transfer)
```
Send 150.00 GBP -> 133.50 EUR

  Recipient     John Smith (GBP)
  Rate          0.89
  Fee           0.56 GBP
  You send      150.00 GBP
  They receive  133.50 EUR
  Reference     Invoice 42

Proceed? [y/N]
```

### Success summary
```
Transfer created and funded.

Quote ID          8fa9be20-ba43-...
Rate              0.89
Source            150.00 GBP
Target            133.50 EUR
Fee               0.56 GBP
Transfer ID       16521632
Transfer Status   processing
Payment Status    COMPLETED
Payment Type      BALANCE
```

## Error Handling

- Quote creation fails: show error, exit
- Requirements unsatisfiable: show missing fields, exit
- Transfer creation fails: show error, exit
- Funding fails (insufficient funds): show rejection reason + transfer ID (user can fund later)
- SCA challenge: handled by existing client.ts auto-retry
