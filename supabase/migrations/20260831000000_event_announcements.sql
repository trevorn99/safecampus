-- The dedup index assumed every deduplicated notification was about one
-- person. Shift reminders key on an assignment id, which already is
-- per-member, so (related_id, template, channel) was unique enough.
--
-- An event announcement keys on the event, and goes to everybody on the
-- team — so the first recipient's row would claim the key and every other
-- insert would collide. Adding member_id makes the key finer without
-- weakening it: the existing reminder rows all carry one, so nothing that
-- was previously blocked becomes possible.
drop index notifications_dedup_idx;

create unique index notifications_dedup_idx
  on notifications(related_id, template, channel, member_id)
  where related_id is not null;
