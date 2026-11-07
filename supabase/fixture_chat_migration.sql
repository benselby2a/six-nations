-- Six Nations Guesser: comments and emoji reactions on the Match Summary screen.
--
-- Run once in the Supabase SQL editor, AFTER profile_second_email_migration.sql. Idempotent.
--
--   fixture_comments    a short comment (max 140 characters) on a fixture, or, when target_user_id is set,
--                       on that competitor's prediction for the fixture
--   fixture_reactions   one emoji per person per fixture (or per prediction); a person can react once with each emoji
--
-- Anyone (including guests) can read. A signed-in competitor adds and removes only their own rows; admins can
-- remove any comment or reaction. Deleting a competitor or a fixture deletes its chat with it.

create table if not exists public.fixture_comments (
    id bigserial primary key,
    match_id integer not null references public.matches(id) on delete cascade,
    user_id integer not null references public.users(id) on delete cascade,
    target_user_id integer references public.users(id) on delete cascade,
    body text not null check (char_length(btrim(body)) between 1 and 140),
    created_at timestamptz not null default now()
);

create table if not exists public.fixture_reactions (
    id bigserial primary key,
    match_id integer not null references public.matches(id) on delete cascade,
    user_id integer not null references public.users(id) on delete cascade,
    target_user_id integer references public.users(id) on delete cascade,
    emoji text not null check (emoji in ('🔥', '😂', '😱', '👏', '😭', '🏉')),
    created_at timestamptz not null default now()
);

create index if not exists fixture_comments_match_idx on public.fixture_comments (match_id);
create index if not exists fixture_reactions_match_idx on public.fixture_reactions (match_id);
create unique index if not exists fixture_reactions_once
    on public.fixture_reactions (match_id, user_id, coalesce(target_user_id, 0), emoji);

alter table public.fixture_comments enable row level security;
alter table public.fixture_reactions enable row level security;

revoke all on public.fixture_comments from anon, authenticated;
revoke all on public.fixture_reactions from anon, authenticated;
grant select on public.fixture_comments, public.fixture_reactions to anon, authenticated;
grant insert, delete on public.fixture_comments, public.fixture_reactions to authenticated;
grant usage, select on sequence public.fixture_comments_id_seq, public.fixture_reactions_id_seq to authenticated;

drop policy if exists fixture_comments_read on public.fixture_comments;
create policy fixture_comments_read on public.fixture_comments for select to anon, authenticated using (true);
drop policy if exists fixture_comments_insert on public.fixture_comments;
create policy fixture_comments_insert on public.fixture_comments for insert to authenticated
    with check (user_id = public.current_competitor_id());
drop policy if exists fixture_comments_delete on public.fixture_comments;
create policy fixture_comments_delete on public.fixture_comments for delete to authenticated
    using (user_id = public.current_competitor_id() or public.is_admin());

drop policy if exists fixture_reactions_read on public.fixture_reactions;
create policy fixture_reactions_read on public.fixture_reactions for select to anon, authenticated using (true);
drop policy if exists fixture_reactions_insert on public.fixture_reactions;
create policy fixture_reactions_insert on public.fixture_reactions for insert to authenticated
    with check (user_id = public.current_competitor_id());
drop policy if exists fixture_reactions_delete on public.fixture_reactions;
create policy fixture_reactions_delete on public.fixture_reactions for delete to authenticated
    using (user_id = public.current_competitor_id() or public.is_admin());
