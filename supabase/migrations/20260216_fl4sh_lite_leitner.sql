begin;

alter table public.fl4sh_lite_cards
  add column if not exists box_number integer not null default 1,
  add column if not exists streak integer not null default 0,
  add column if not exists last_reviewed_at timestamptz,
  add column if not exists next_review_at timestamptz not null default now();

alter table public.fl4sh_lite_cards
  drop constraint if exists fl4sh_lite_cards_box_number_check;

alter table public.fl4sh_lite_cards
  add constraint fl4sh_lite_cards_box_number_check
  check (box_number between 1 and 5);

update public.fl4sh_lite_cards
set
  box_number = coalesce(box_number, 1),
  streak = coalesce(streak, 0),
  next_review_at = coalesce(next_review_at, created_at, now())
where
  box_number is null
  or streak is null
  or next_review_at is null;

create index if not exists fl4sh_lite_cards_due_idx
  on public.fl4sh_lite_cards(user_id, subject_key, next_review_at);

commit;
