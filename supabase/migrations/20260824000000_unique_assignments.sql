-- One assignment per person per position.
--
-- Nothing enforced this, and several paths guard with a select-then-insert
-- that races: a double-clicked "Sign up", the standing-roster fan-out running
-- while an admin assigns the same person, the same member reached by both the
-- event-level checkbox and the series card. The result is one person listed
-- twice on a position, counting twice against its slots.

-- Existing duplicates have to go first or the index can't be created. Keep
-- the most meaningful row rather than simply the oldest: a confirmed
-- assignment outranks a proposed one, which outranks a declined one, and
-- created_at (then id) breaks the remaining ties. Deleting the confirmation
-- and keeping an accidental re-add would lose the fact that someone had
-- actually accepted the shift.
delete from assignments a
using assignments b
where a.event_position_id = b.event_position_id
  and a.member_id = b.member_id
  and (
    case a.status when 'confirmed' then 0 when 'proposed' then 1 else 2 end,
    a.created_at,
    a.id
  ) > (
    case b.status when 'confirmed' then 0 when 'proposed' then 1 else 2 end,
    b.created_at,
    b.id
  );

create unique index assignments_position_member_idx
  on assignments(event_position_id, member_id);
