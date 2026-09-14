-- Two gaps in attendance, both of which matter more once people check
-- themselves in from a phone rather than an admin doing it at a desk.

-- 1. Nothing stopped a second row for the same person at the same event, so
--    a double-tap — or a flaky connection retried — counted somebody twice
--    and made the event's attendance figure wrong. Existing duplicates are
--    collapsed to the earliest check-in, which is the one that records when
--    they actually arrived; any check-out time on a later duplicate is
--    carried onto it so nothing is lost.
update attendance keep
set checked_out_at = coalesce(keep.checked_out_at, dup.checked_out_at)
from attendance dup
where dup.member_id = keep.member_id
  and dup.event_id = keep.event_id
  and keep.event_id is not null
  and (keep.checked_in_at, keep.id) < (dup.checked_in_at, dup.id)
  and dup.checked_out_at is not null;

delete from attendance a
using attendance b
where a.member_id = b.member_id
  and a.event_id = b.event_id
  and a.event_id is not null
  and (a.checked_in_at, a.id) > (b.checked_in_at, b.id);

-- Partial, because event_id is nullable — attendance can be recorded against
-- a location with no event, and several of those for one person is fine.
create unique index attendance_member_event_idx
  on attendance(member_id, event_id)
  where event_id is not null;

-- 2. Attendance answered "did Trevor turn up", not "was the Lobby covered".
--    For a security team the second question is the one that matters, and
--    the first can't answer it: somebody present but standing somewhere else
--    still leaves a door unwatched.
--
--    Nullable, and permanently so — attendance recorded before anyone was
--    assigned a position, or at an event with no positions at all, is still
--    a real record of someone being there.
alter table attendance
  add column event_position_id uuid references event_positions(id) on delete set null;

create index attendance_position_idx on attendance(event_position_id);
