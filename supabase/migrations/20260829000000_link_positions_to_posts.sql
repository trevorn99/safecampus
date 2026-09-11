-- Connect the staffing requirements that already exist to the posts created
-- in 20260828000000, so the link isn't something every template has to be
-- re-entered to gain.
--
-- Matched on name, case-insensitively, and only where the name identifies
-- exactly one post in the organization. A "Lobby" post at two different
-- campuses is genuinely ambiguous — a template position that says only
-- "Lobby" doesn't say which building — so those are left null for someone to
-- set in the UI rather than guessed at. Null is a perfectly good permanent
-- answer here anyway.
update template_positions tp
set post_id = lp.id
from location_posts lp, event_templates t
where t.id = tp.template_id
  and lp.organization_id = t.organization_id
  and tp.post_id is null
  and lower(lp.name) = lower(tp.title)
  and (
    select count(*) from location_posts lp2
    where lp2.organization_id = t.organization_id and lower(lp2.name) = lower(tp.title)
  ) = 1;

-- Concrete positions inherit from the template position they were generated
-- from. Positions added straight to a single event have no template position
-- and stay null until someone sets one.
update event_positions ep
set post_id = tp.post_id
from template_positions tp
where tp.id = ep.template_position_id
  and ep.post_id is null
  and tp.post_id is not null;
