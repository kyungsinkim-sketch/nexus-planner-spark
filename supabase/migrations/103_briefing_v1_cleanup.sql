-- Migration 103: Clean up stale v1 Brain AI briefings from chat_messages
--
-- Background
--   The Brain AI daily briefing is persisted as a Brain→user DM in
--   `chat_messages` with a leading invisible marker. The v1 format was:
--
--       <!--briefing:YYYY-MM-DD-->\n<body>
--
--   That version had a bug where "requested_by_me" TODOs (delegations I
--   created but assigned to others) were surfaced in *my* briefing via
--   the unfiltered `getTodos()` call. The filter in `buildBriefingText`
--   has since been corrected and the marker bumped to v2:
--
--       <!--briefing:YYYY-MM-DD:v2-->\n<body>
--
--   The existence check in `ensureTodaysBriefing` now only matches v2
--   markers, so a fresh (correct) briefing gets inserted. However, the
--   old v1 rows remain in the user's Brain DM history — and they appear
--   alongside the new v2 briefing on the same day, producing a visually
--   duplicated briefing. Client-side deletion is impossible because
--   `chat_messages` DELETE RLS only permits `user_id = auth.uid()` and
--   briefing rows are authored by the Brain bot ID.
--
-- What this migration does
--   Server-side one-shot purge of v1 briefing rows (those whose content
--   starts with `<!--briefing:` followed by exactly 10 char YYYY-MM-DD
--   and immediately `-->` — i.e. no `:vN` version suffix).
--
--   Safe to re-run: if no v1 rows exist the DELETE is a no-op. v2 rows
--   are not matched by the pattern.

DELETE FROM chat_messages
WHERE user_id = '00000000-0000-0000-0000-000000000099'  -- BRAIN_BOT_ID
  AND content LIKE '<!--briefing:____-__-__-->%';
