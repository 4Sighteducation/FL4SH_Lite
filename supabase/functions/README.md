# FL4SH Lite Edge Functions

These functions are designed for a Knack-authenticated FL4SH Lite web embed.
All user data writes happen in this project (`fl4sh_lite_*` tables), while curriculum catalog data can be proxied from a separate Supabase project.

## Functions

- `fl4sh-lite-context`
  - Upserts `fl4sh_lite_users`
  - Returns selected subjects + card stats + available catalog
- `fl4sh-lite-catalog`
  - Returns filtered subject catalog (proxied from curriculum project)
- `fl4sh-lite-select-subjects`
  - Replaces selected subjects for user (max 2 enforced by DB trigger)
- `fl4sh-lite-create-card`
  - Creates a card (max 20 per subject enforced by DB trigger)
- `fl4sh-lite-generate-cards`
  - Uses existing FL4SH generator endpoint for prompt parity
  - Inserts generated cards into `fl4sh_lite_cards` (limits still enforced by DB)
- `fl4sh-lite-list-cards`
  - Lists cards (+ stats) for user / subject
- `fl4sh-lite-delete-card`
  - Deletes one user-owned card
- `fl4sh-lite-upsell-event`
  - Logs CTA/modal conversion events

## Required environment variables

In the **app-facing project** (the one storing `fl4sh_lite_*` tables):

- `SUPABASE_URL` (provided by Supabase runtime)
- `SUPABASE_SERVICE_ROLE_KEY` (provided in function secrets)

For cross-project catalog proxy:

- `CURRICULUM_SUPABASE_URL`
- `CURRICULUM_SUPABASE_SERVICE_ROLE_KEY`
- `CURRICULUM_CATALOG_SOURCE` (default: `fl4sh_lite_subject_catalog`)
- `CURRICULUM_CATALOG_LIMIT` (default: `500`)

Optional request hardening:

- `FL4SH_LITE_BRIDGE_SECRET`
  - If set, requests must include header `x-fl4sh-lite-secret`.

Optional generator override:

- `FL4SH_GENERATOR_URL`
  - Defaults to `https://www.fl4sh.cards/api/generate-cards`

## Shared request identity payload

Most endpoints expect:

```json
{
  "email": "student@example.com",
  "name": "Student Name",
  "school_name": "School Name",
  "qualification_level": "A_LEVEL",
  "knack_user_id": "rec_xxx"
}
```

## Deployment notes

- Deploy functions via Supabase dashboard (Functions) or CLI.
- Configure secrets before invoking from frontend/loader bridge.
- Keep client-side code calling only these functions (not direct table writes).
