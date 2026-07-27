-- MFA enforcement, database layer.
--
-- App code forces org_admin/location_manager accounts through enrollment
-- and challenges them at sign-in (see requireMembership() and
-- /auth/callback), but that's a UX nag, not a real barrier — a stolen
-- aal1 session token could still call the API directly, bypassing the
-- Next.js app entirely. Requiring aal2 in the JWT for the watchlist
-- specifically (the most sensitive table in the schema, see brief §06)
-- makes that data actually inaccessible without a completed second
-- factor, not just inconvenient to reach through the UI.

create or replace function public.is_aal2()
returns boolean
language sql stable
as $$
  select coalesce(auth.jwt()->>'aal', '') = 'aal2';
$$;

drop policy "restricted watchlist read" on watchlist_entries;
drop policy "restricted watchlist write" on watchlist_entries;
drop policy "restricted watchlist update" on watchlist_entries;
drop policy "restricted watchlist delete" on watchlist_entries;

create policy "restricted watchlist read" on watchlist_entries
  for select using (
    is_aal2() and (is_org_admin(organization_id) or (location_id is not null and is_location_manager(location_id)))
  );
create policy "restricted watchlist write" on watchlist_entries
  for insert with check (
    is_aal2() and (is_org_admin(organization_id) or (location_id is not null and is_location_manager(location_id)))
  );
create policy "restricted watchlist update" on watchlist_entries
  for update using (
    is_aal2() and (is_org_admin(organization_id) or (location_id is not null and is_location_manager(location_id)))
  );
create policy "restricted watchlist delete" on watchlist_entries
  for delete using (is_aal2() and is_org_admin(organization_id));
