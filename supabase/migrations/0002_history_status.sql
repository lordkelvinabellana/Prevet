-- Slice 2: deferred PPSR (two-phase assessment).
--
-- A price-only assessment is created first (history_status = 'not_checked');
-- the PPSR history check is a separate, user-approved step that finalizes the
-- verdict and flips this to 'checked'. history_check_id stays null until then.
alter table public.assessments
  add column if not exists history_status text not null default 'not_checked'
  check (history_status in ('not_checked', 'checked'));
