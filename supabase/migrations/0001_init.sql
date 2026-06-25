-- Car Pre-Vetting Tool — Slice 1 schema
-- Tables: cars, valuations, history_checks, assessments
-- Access model (Slice 1): any AUTHENTICATED user can create and review.
-- RLS is enabled on every table; anonymous access is denied by default.

-- ---------------------------------------------------------------------------
-- cars
-- ---------------------------------------------------------------------------
create table if not exists public.cars (
  id                  uuid primary key default gen_random_uuid(),
  plate               text,
  vin                 text,
  year                int  not null check (year between 1900 and 2100),
  make                text not null check (length(trim(make)) > 0),
  model               text not null check (length(trim(model)) > 0),
  trim                text,
  kilometres          int  not null check (kilometres >= 0 and kilometres <= 2000000),
  seller_asking_price numeric(12, 2) not null check (seller_asking_price > 0),
  created_by          uuid not null default auth.uid() references auth.users (id),
  created_at          timestamptz not null default now(),
  -- At least one identifier is required (mirrors zod validation).
  constraint cars_plate_or_vin check (plate is not null or vin is not null)
);

-- ---------------------------------------------------------------------------
-- valuations (RedBook-style; nullable when valuation is unavailable)
-- ---------------------------------------------------------------------------
create table if not exists public.valuations (
  id                       uuid primary key default gen_random_uuid(),
  car_id                   uuid not null references public.cars (id) on delete cascade,
  source                   text not null,
  wholesale_low            numeric(12, 2),
  wholesale_high           numeric(12, 2),
  retail_low               numeric(12, 2),
  retail_high              numeric(12, 2),
  selected_wholesale_value numeric(12, 2),
  created_at               timestamptz not null default now()
);
create index if not exists valuations_car_id_idx on public.valuations (car_id);

-- ---------------------------------------------------------------------------
-- history_checks (PPSR-style)
-- ---------------------------------------------------------------------------
create table if not exists public.history_checks (
  id            uuid primary key default gen_random_uuid(),
  car_id        uuid not null references public.cars (id) on delete cascade,
  finance_owing boolean not null default false,
  stolen        boolean not null default false,
  written_off   boolean not null default false,
  source        text not null,
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists history_checks_car_id_idx on public.history_checks (car_id);

-- ---------------------------------------------------------------------------
-- assessments (deterministic engine output + human review)
-- ---------------------------------------------------------------------------
create table if not exists public.assessments (
  id               uuid primary key default gen_random_uuid(),
  car_id           uuid not null references public.cars (id) on delete cascade,
  valuation_id     uuid references public.valuations (id),
  history_check_id uuid references public.history_checks (id),
  repair_cost      numeric(12, 2) not null check (repair_cost >= 0),
  risk_buffer      numeric(12, 2),
  max_offer        numeric(12, 2),
  recommendation   text not null check (recommendation in ('buy', 'pass', 'check')),
  -- Full traceability: the rendered explanation, the deciding codes, and the
  -- exact calculation breakdown the deterministic engine produced.
  reasoning        text not null,
  reason_codes     text[] not null default '{}',
  breakdown        jsonb,
  review_status    text not null default 'pending' check (review_status in ('pending', 'reviewed')),
  reviewed_by      uuid references auth.users (id),
  reviewed_at      timestamptz,
  created_by       uuid not null default auth.uid() references auth.users (id),
  created_at       timestamptz not null default now()
);
create index if not exists assessments_car_id_idx on public.assessments (car_id);
create index if not exists assessments_created_at_idx on public.assessments (created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.cars           enable row level security;
alter table public.valuations     enable row level security;
alter table public.history_checks enable row level security;
alter table public.assessments    enable row level security;

-- cars: authenticated users read all; insert their own rows.
create policy "cars_select_authenticated" on public.cars
  for select to authenticated using (true);
create policy "cars_insert_own" on public.cars
  for insert to authenticated with check (created_by = auth.uid());

-- valuations: authenticated users read all; insert tied to an existing car.
create policy "valuations_select_authenticated" on public.valuations
  for select to authenticated using (true);
create policy "valuations_insert_authenticated" on public.valuations
  for insert to authenticated with check (true);

-- history_checks: same as valuations.
create policy "history_select_authenticated" on public.history_checks
  for select to authenticated using (true);
create policy "history_insert_authenticated" on public.history_checks
  for insert to authenticated with check (true);

-- assessments: authenticated users read all, insert their own, and update
-- (used for the review status / reviewer fields). No delete policy => denied.
create policy "assessments_select_authenticated" on public.assessments
  for select to authenticated using (true);
create policy "assessments_insert_own" on public.assessments
  for insert to authenticated with check (created_by = auth.uid());
create policy "assessments_update_authenticated" on public.assessments
  for update to authenticated using (true) with check (true);
