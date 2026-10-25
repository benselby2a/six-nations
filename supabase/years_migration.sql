-- Six Nations Guesser: multi-year support migration.
--
-- Run once in the Supabase SQL editor, AFTER auth_migration.sql. Idempotent.
--
-- This migration is additive, so the previously deployed app keeps working after it runs:
-- all existing data becomes year 2026, and old columns (users.total_tries, the
-- predictions_locked setting, scoring_rules id = 1) are left in place.
--
-- What changes:
--   * matches.year          fixtures belong to a year (predictions and jokers follow via match_id)
--   * seasons               the list of years shown in the year dropdown
--   * user_tries            tournament tries predicted, per competitor per year
--   * scoring_rules.year    scoring and prize rules per year (one row per year)
--   * scoring_close_tiers.year  close-score tiers per year
--   * settings              prediction lock per year, stored as key 'predictions_locked:<year>'

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

alter table public.matches add column if not exists year integer not null default 2026;
create index if not exists matches_year_idx on public.matches (year);

-- ---------------------------------------------------------------------------
-- Seasons
-- ---------------------------------------------------------------------------

create table if not exists public.seasons (
    year integer primary key,
    created_at timestamptz not null default now()
);

insert into public.seasons (year) values (2026) on conflict (year) do nothing;
insert into public.seasons (year) select distinct year from public.matches on conflict (year) do nothing;

-- ---------------------------------------------------------------------------
-- Tournament tries per year
-- ---------------------------------------------------------------------------

create table if not exists public.user_tries (
    user_id integer not null references public.users(id) on delete cascade,
    year integer not null,
    total_tries integer,
    primary key (user_id, year)
);

insert into public.user_tries (user_id, year, total_tries)
select id, 2026, total_tries from public.users where total_tries is not null
on conflict (user_id, year) do nothing;

-- ---------------------------------------------------------------------------
-- Scoring rules and close tiers per year
-- ---------------------------------------------------------------------------

alter table public.scoring_rules add column if not exists year integer not null default 2026;
alter table public.scoring_close_tiers add column if not exists year integer not null default 2026;

do $$
declare
    c record;
    tier_attnum smallint;
begin
    -- scoring_rules was a singleton (CHECK (id = 1)); it is now one row per year.
    for c in
        select conname from pg_constraint
         where conrelid = 'public.scoring_rules'::regclass
           and contype = 'c'
           and pg_get_constraintdef(oid) ilike '%id = 1%'
    loop
        execute format('alter table public.scoring_rules drop constraint %I', c.conname);
    end loop;

    if not exists (select 1 from pg_constraint where conname = 'scoring_rules_year_key') then
        alter table public.scoring_rules add constraint scoring_rules_year_key unique (year);
    end if;

    -- scoring_close_tiers was unique on tier_order alone; it is now unique per (year, tier_order).
    select attnum into tier_attnum
      from pg_attribute
     where attrelid = 'public.scoring_close_tiers'::regclass and attname = 'tier_order';

    for c in
        select conname from pg_constraint
         where conrelid = 'public.scoring_close_tiers'::regclass
           and contype = 'u'
           and conkey = array[tier_attnum]
    loop
        execute format('alter table public.scoring_close_tiers drop constraint %I', c.conname);
    end loop;

    if not exists (select 1 from pg_constraint where conname = 'scoring_close_tiers_year_tier_order_key') then
        alter table public.scoring_close_tiers
            add constraint scoring_close_tiers_year_tier_order_key unique (year, tier_order);
    end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Prediction lock per year
-- ---------------------------------------------------------------------------

insert into public.settings (key, value)
select 'predictions_locked:2026', value from public.settings where key = 'predictions_locked'
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Row level security for the new tables
-- ---------------------------------------------------------------------------

alter table public.seasons enable row level security;
alter table public.user_tries enable row level security;

drop policy if exists seasons_select on public.seasons;
drop policy if exists seasons_write on public.seasons;
drop policy if exists user_tries_select on public.user_tries;
drop policy if exists user_tries_write on public.user_tries;

create policy seasons_select on public.seasons for select to anon, authenticated using (true);
create policy seasons_write on public.seasons for all to authenticated
    using (public.is_admin()) with check (public.is_admin());

create policy user_tries_select on public.user_tries for select to anon, authenticated using (true);
create policy user_tries_write on public.user_tries for all to authenticated
    using (user_id = public.current_competitor_id() or public.is_admin())
    with check (user_id = public.current_competitor_id() or public.is_admin());
