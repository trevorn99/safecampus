-- Switches billing from per-seat to three flat-rate plans, keyed to active
-- member count: tier_10 ($35, <=10), tier_30 ($80, <=30), tier_50 ($160,
-- <=50). Orgs auto-upgrade as their roster grows past a cap — see
-- syncPlanTier() in src/lib/billing.ts, called whenever a member goes from
-- pending to active. Null means no plan chosen yet (still trialing).

alter table organizations
  add column plan_tier text check (plan_tier in ('tier_10', 'tier_30', 'tier_50'));
