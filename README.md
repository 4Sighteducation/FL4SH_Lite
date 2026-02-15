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

## Next implementation steps

1. Deploy functions from `supabase/functions/*`
2. Add frontend shell to call `fl4sh-lite-context` on load
3. Add persistent CTA banner + limit popups
4. Wire Knack loader scene/view to the Lite app
