-- A report row is now inserted as a placeholder the moment generation
-- starts (status 'generating'), then updated in place once it finishes —
-- not inserted only at the end. This closes a race: previously, leaving
-- the page (or a retry, or the weekly cron overlapping an on-demand click)
-- while a report was still generating had no way to detect that and could
-- kick off a second concurrent generation for the same location. See
-- getGenerationStatus() in src/lib/threatIntelligence.ts.

alter table threat_reports drop constraint threat_reports_status_check;
alter table threat_reports
  add constraint threat_reports_status_check check (status in ('generating', 'draft', 'reviewed', 'released'));
