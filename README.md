# FL4SH Lite

FL4SH Lite is a Knack-authenticated web experience designed to give VESPA students a limited free tier and funnel upgrades to native FL4SH.

## Current scaffold

- Supabase edge functions in `supabase/functions/*`
- Uses existing DB tables:
  - `fl4sh_lite_users`
  - `fl4sh_lite_user_subjects`
  - `fl4sh_lite_cards`
  - `fl4sh_lite_events`

## Upsell destinations

- iOS: https://apps.apple.com/in/app/fl4sh-study-smarter/id6747457678
- Android: https://play.google.com/store/apps/details?id=com.foursighteducation.flash&pcampaignid=web_share
- Website: https://www.fl4shcards.com

## Frontend local setup

1. Copy `.env.example` to `.env`
2. Set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_FL4SH_LITE_BRIDGE_SECRET` (if configured in function secrets)
3. Run:
   - `npm install`
   - `npm run dev`

For local testing outside Knack, keep `VITE_ENABLE_LOCAL_MOCK=true`.

## Production deploy (Vercel)

- Build command: `npm run build`
- Output directory: `dist`
- Add the same env vars in Vercel project settings.

## App behavior in this repo

- Desktop/tablet-first UI for subject selection + flashcards
- Hard limits: 2 subjects and 20 cards per subject
- Manual card creation via `fl4sh-lite-create-card`
- AI generation via `fl4sh-lite-generate-cards` (reusing FL4SH generator endpoint for prompt parity)
- Strong upsell CTAs to:
  - iOS app
  - Android app
  - fl4shcards.com
