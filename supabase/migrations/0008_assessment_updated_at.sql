-- Car Pre-Vetting Tool — track when an assessment was last changed
--
-- The list/cards showed `created_at`, which never moves — so editing a car
-- (re-running the engine) left the displayed date stale. Add `updated_at`, bumped
-- by a trigger on every UPDATE (edit, mark-reviewed, record-purchase, PPSR), and
-- show/sort by it instead. Backfilled to created_at for existing rows.

alter table public.assessments
  add column if not exists updated_at timestamptz not null default now();

update public.assessments set updated_at = created_at where updated_at = created_at;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists assessments_set_updated_at on public.assessments;
create trigger assessments_set_updated_at
  before update on public.assessments
  for each row execute function public.set_updated_at();
