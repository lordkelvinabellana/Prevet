-- Purchase tracking: record the actual purchase when a car is bought, so the
-- team can track spend and money saved vs the asking price. One purchase per
-- assessment (purchase_price not null ⇒ purchased). The existing
-- assessments_update_authenticated RLS policy already permits writing these.
alter table public.assessments
  add column if not exists purchase_price numeric(12, 2)
    check (purchase_price is null or purchase_price > 0),
  add column if not exists purchased_at timestamptz,
  add column if not exists purchase_note text,
  add column if not exists purchased_by uuid references auth.users (id);
