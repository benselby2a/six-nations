-- Six Nations Guesser: let people react with a team flag as well.
--
-- Run once in the Supabase SQL editor, AFTER fixture_chat_migration.sql. Idempotent.
--
-- Every fixture now offers the home and away team flag as two extra reactions, so the allowed emoji list in
-- fixture_reactions grows from the six originals to those six plus the six Six Nations flags.

alter table public.fixture_reactions drop constraint if exists fixture_reactions_emoji_check;
alter table public.fixture_reactions
    add constraint fixture_reactions_emoji_check
    check (emoji in ('🔥', '😂', '😱', '👏', '😭', '🏉', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🇫🇷', '🇮🇪', '🇮🇹', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', '🏴󠁧󠁢󠁷󠁬󠁳󠁿'));
