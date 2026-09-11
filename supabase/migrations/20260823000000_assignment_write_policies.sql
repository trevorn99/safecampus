-- Two gaps in who may write an assignment.
--
-- 1. Volunteers signing themselves up has never worked. SelfAssignButton is
--    rendered only when the viewer is NOT an org admin, and the sole insert
--    policy on assignments requires is_org_admin() — so the button was shown
--    exclusively to the people the database refused. Every click failed.
--
-- 2. Team leads can manage a recurring position's standing roster
--    (20260822000000) but couldn't write the per-occurrence assignments that
--    implies, so the fan-out would fail for them the moment a team-lead
--    surface exists.
--
-- Deletion stays org-admin only. A volunteer withdraws by setting their own
-- assignment to 'declined', which the existing update policy already allows
-- and which keeps the record of who dropped out — where a delete would
-- silently erase it.

create policy "member signs themselves up" on assignments
  for insert with check (
    exists (select 1 from members m where m.id = assignments.member_id and m.user_id = auth.uid())
    and exists (
      select 1 from event_positions p
      join events e on e.id = p.event_id
      where p.id = assignments.event_position_id
        and e.organization_id in (select current_org_ids())
    )
  );

create policy "team lead manages their team's assignments" on assignments
  for insert with check (
    exists (
      select 1 from event_positions p
      where p.id = assignments.event_position_id
        and p.team_id is not null
        and is_lead_of_team(p.team_id)
    )
  );

create policy "team lead removes their team's assignments" on assignments
  for delete using (
    exists (
      select 1 from event_positions p
      where p.id = assignments.event_position_id
        and p.team_id is not null
        and is_lead_of_team(p.team_id)
    )
  );
