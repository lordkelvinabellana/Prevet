-- Reviewer notes: an optional free-text note a reviewer can leave when marking
-- an assessment reviewed. Nullable; the existing RLS update policy
-- (assessments_update_authenticated) already permits writing it.
alter table public.assessments
  add column if not exists reviewer_note text;
