-- Car Pre-Vetting Tool — allow owners to delete their cars (and cascade)
--
-- Slice 1 shipped with NO delete policy, so deletes were denied. The "delete an
-- assessment" feature deletes the CAR row — the FK cascades remove its valuation,
-- history check, and assessment (see 0001). Per-user, like every other policy.
-- Photo objects in the private car-photos bucket are removed by the server action
-- before the row is deleted.

create policy "cars_delete_own" on public.cars
  for delete to authenticated
  using (created_by = auth.uid());
