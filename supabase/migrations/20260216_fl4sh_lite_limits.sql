begin;

create or replace function public.fl4sh_lite_enforce_subject_limit()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*)
    from public.fl4sh_lite_user_subjects s
    where s.user_id = new.user_id
      and s.subject_key <> new.subject_key
  ) >= 2 then
    raise exception 'SUBJECT_LIMIT_REACHED';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_fl4sh_lite_subject_limit on public.fl4sh_lite_user_subjects;
create trigger trg_fl4sh_lite_subject_limit
before insert or update of user_id, subject_key on public.fl4sh_lite_user_subjects
for each row
execute function public.fl4sh_lite_enforce_subject_limit();

create or replace function public.fl4sh_lite_enforce_card_limit()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.fl4sh_lite_user_subjects s
    where s.user_id = new.user_id
      and s.subject_key = new.subject_key
  ) then
    raise exception 'SUBJECT_NOT_SELECTED';
  end if;

  if (
    select count(*)
    from public.fl4sh_lite_cards c
    where c.user_id = new.user_id
      and c.subject_key = new.subject_key
      and c.id <> new.id
  ) >= 20 then
    raise exception 'CARD_LIMIT_REACHED';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_fl4sh_lite_card_limit on public.fl4sh_lite_cards;
create trigger trg_fl4sh_lite_card_limit
before insert or update of user_id, subject_key on public.fl4sh_lite_cards
for each row
execute function public.fl4sh_lite_enforce_card_limit();

commit;
