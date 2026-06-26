-- Car Pre-Vetting Tool — per-user data isolation
--
-- Slice 1 shipped a SHARED model: every SELECT policy was `using (true)`, so any
-- authenticated user could read every other user's rows. This migration tightens
-- read/write to the owner only — each user sees and edits exactly their own data,
-- enforced by Postgres RLS (not the app, which never filters by created_by).
--
-- Inserts already required `created_by = auth.uid()`, so they are unchanged.
-- cars/assessments own their `created_by`; valuations/history_checks have none,
-- so they are scoped through the owning car.

-- cars: read only your own.
alter policy "cars_select_authenticated" on public.cars
  rename to "cars_select_own";
alter policy "cars_select_own" on public.cars
  using (created_by = auth.uid());

-- assessments: read + update only your own (update covers review / record-purchase).
alter policy "assessments_select_authenticated" on public.assessments
  rename to "assessments_select_own";
alter policy "assessments_select_own" on public.assessments
  using (created_by = auth.uid());

alter policy "assessments_update_authenticated" on public.assessments
  rename to "assessments_update_own";
alter policy "assessments_update_own" on public.assessments
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- valuations: scoped via the owning car (no created_by column of its own).
alter policy "valuations_select_authenticated" on public.valuations
  rename to "valuations_select_own";
alter policy "valuations_select_own" on public.valuations
  using (
    exists (
      select 1 from public.cars c
      where c.id = valuations.car_id and c.created_by = auth.uid()
    )
  );

alter policy "valuations_insert_authenticated" on public.valuations
  rename to "valuations_insert_own";
alter policy "valuations_insert_own" on public.valuations
  with check (
    exists (
      select 1 from public.cars c
      where c.id = valuations.car_id and c.created_by = auth.uid()
    )
  );

-- history_checks: same car-ownership scoping.
alter policy "history_select_authenticated" on public.history_checks
  rename to "history_select_own";
alter policy "history_select_own" on public.history_checks
  using (
    exists (
      select 1 from public.cars c
      where c.id = history_checks.car_id and c.created_by = auth.uid()
    )
  );

alter policy "history_insert_authenticated" on public.history_checks
  rename to "history_insert_own";
alter policy "history_insert_own" on public.history_checks
  with check (
    exists (
      select 1 from public.cars c
      where c.id = history_checks.car_id and c.created_by = auth.uid()
    )
  );
