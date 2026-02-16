begin;

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

  -- Lite cap applies to AI-generated cards only.
  if coalesce(new.card_type, '') like 'ai_%' then
    if (
      select count(*)
      from public.fl4sh_lite_cards c
      where c.user_id = new.user_id
        and c.subject_key = new.subject_key
        and coalesce(c.card_type, '') like 'ai_%'
        and c.id <> new.id
    ) >= 20 then
      raise exception 'CARD_LIMIT_REACHED';
    end if;
  end if;

  return new;
end;
$$;

commit;
