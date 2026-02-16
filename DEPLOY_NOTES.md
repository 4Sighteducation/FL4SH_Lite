# FL4SH Lite Deploy Notes

## Edge Function bundling rule

When deploying from the Supabase dashboard, each function is bundled from its own
directory. Avoid importing local files from sibling directories (for example,
`../_shared/*`) unless your deployment method explicitly supports it.

To keep dashboard deploys reliable:

- Prefer self-contained function files.
- If shared code is required, deploy through a workflow that uploads shared files
  together with function sources.

## Current limits (Lite)

- Maximum subjects per user: `2`
- Maximum cards per subject: `20`

These limits are enforced in both:

- Edge function validation
- Database triggers (`supabase/migrations/20260216_fl4sh_lite_limits.sql`)

## Recommended deployment order

1. Run migrations.
2. Deploy edge functions.
3. Verify `fl4sh-lite-context` returns the expected limits.
4. Verify subject/card limit errors:
   - `SUBJECT_LIMIT_REACHED`
   - `CARD_LIMIT_REACHED`
