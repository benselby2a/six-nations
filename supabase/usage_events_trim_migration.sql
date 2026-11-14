-- Six Nations Guesser: keep only the latest 100 usage events.
--
-- Run once in the Supabase SQL editor. Idempotent.
--
-- Every insert into usage_events now also deletes everything but the newest 100 rows (a trigger, so it works
-- for every signed-in person, not just admins). Rows already there beyond the newest 100 are removed when this runs.

create or replace function public.trim_usage_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    delete from public.usage_events
     where id < (select id from public.usage_events order by id desc offset 99 limit 1);
    return null;
end;
$$;

revoke all on function public.trim_usage_events() from public, anon, authenticated;

drop trigger if exists usage_events_trim on public.usage_events;
create trigger usage_events_trim
    after insert on public.usage_events
    for each statement execute function public.trim_usage_events();

-- Trim what is there now
delete from public.usage_events
 where id < (select id from public.usage_events order by id desc offset 99 limit 1);
