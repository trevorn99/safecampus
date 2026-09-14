-- Reconnect occurrence positions to the template position they came from.
--
-- generateSeriesOccurrences never set event_positions.template_position_id
-- until it was fixed on 2026-09-11. Everything generated before that carries
-- null — and since the horizon had just been widened to a year, that's very
-- nearly every future event on the calendar.
--
-- That column is how a series reaches its occurrences. With it null:
--   • adding a regular fans out to nothing, so the assignment never appears
--     on any event;
--   • the "apply to every future event in this series" checkbox doesn't
--     render at all, because the form can't find a template position;
--   • removing a regular likewise clears nothing.
-- The generator writes it correctly now, but only for occurrences created
-- from here on, so the existing ones have to be matched up.
--
-- Matched on title within the series' own template, and only where the title
-- identifies exactly one template position. Two positions called "Lobby" on
-- one template can't be told apart by name, so those are left alone rather
-- than linked to a coin-flip.
update event_positions ep
set template_position_id = tp.id
from events e
join event_series s on s.id = e.series_id
join template_positions tp on tp.template_id = s.template_id
where ep.event_id = e.id
  and ep.template_position_id is null
  and lower(tp.title) = lower(ep.title)
  and (
    select count(*) from template_positions tp2
    where tp2.template_id = s.template_id and lower(tp2.title) = lower(ep.title)
  ) = 1;

-- Now that the link exists, the post can follow it. Positions added straight
-- to a single event still have neither, which is correct.
update event_positions ep
set post_id = tp.post_id
from template_positions tp
where tp.id = ep.template_position_id
  and ep.post_id is null
  and tp.post_id is not null;
