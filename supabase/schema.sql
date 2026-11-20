-- NutriSalud+ / NutriPresión
-- Run once in Supabase SQL Editor before enabling the public client key.
-- Keep email confirmation enabled in Supabase Auth.

create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  role text not null default 'patient' check (role in ('patient', 'admin')),
  birth_date date,
  phone text,
  height_cm numeric(5,1) check (height_cm is null or height_cm between 50 and 300),
  weight_kg numeric(6,1) check (weight_kg is null or weight_kg between 1 and 500),
  nutritional_goal text,
  created_at timestamptz not null default now()
);

create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  weight_kg numeric(6,1) check (weight_kg is null or weight_kg between 1 and 500),
  height_cm numeric(5,1) check (height_cm is null or height_cm between 50 and 300),
  bmi numeric(5,1) check (bmi is null or bmi between 1 and 150),
  systolic integer check (systolic is null or systolic between 40 and 300),
  diastolic integer check (diastolic is null or diastolic between 20 and 200),
  heart_rate integer check (heart_rate is null or heart_rate between 20 and 250),
  measured_at timestamptz not null default now(),
  constraint measurements_pressure_pair check ((systolic is null) = (diastolic is null))
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  scheduled_at timestamptz not null,
  reason text not null check (length(trim(reason)) between 2 and 500),
  status text not null default 'pendiente'
    check (status in ('pendiente', 'confirmada', 'rechazada', 'cancelada')),
  created_at timestamptz not null default now()
);

-- Calculate BMI in the database and keep the profile's latest values in sync.
create or replace function private.prepare_measurement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.weight_kg is not null and new.height_cm is not null then
    new.bmi := round(new.weight_kg / power(new.height_cm / 100, 2), 1);
  else
    new.bmi := null;
  end if;
  return new;
end;
$$;

create or replace function private.sync_profile_measurement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set height_cm = coalesce(new.height_cm, height_cm),
      weight_kg = coalesce(new.weight_kg, weight_kg)
  where id = new.patient_id;
  return new;
end;
$$;

drop trigger if exists measurements_prepare_values on public.measurements;
create trigger measurements_prepare_values
  before insert on public.measurements
  for each row execute function private.prepare_measurement();

drop trigger if exists measurements_sync_profile on public.measurements;
create trigger measurements_sync_profile
  after insert on public.measurements
  for each row execute function private.sync_profile_measurement();

create index if not exists measurements_patient_date_idx
  on public.measurements(patient_id, measured_at desc);
create index if not exists appointments_patient_date_idx
  on public.appointments(patient_id, scheduled_at desc);
create index if not exists appointments_status_date_idx
  on public.appointments(status, scheduled_at);

-- Admin check runs as the function owner so RLS on profiles does not recurse.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;
revoke all on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

-- Every Auth account gets a profile. Only the confirmed clinic email becomes admin.
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case
      when lower(new.email) = 'gustavo.godoy2357@alumnos.udg.mx'
       and new.email_confirmed_at is not null then 'admin'
      else 'patient'
    end
  )
  on conflict (id) do update set
    email = excluded.email,
    role = case
      when excluded.email = 'gustavo.godoy2357@alumnos.udg.mx'
       and new.email_confirmed_at is not null then 'admin'
      else public.profiles.role
    end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_profile_created on auth.users;
create trigger on_auth_user_profile_created
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function private.handle_new_auth_user();

-- Backfill accounts that already existed before this schema was installed.
insert into public.profiles (id, email, full_name, role, created_at)
select
  u.id,
  lower(u.email),
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  case
    when lower(u.email) = 'gustavo.godoy2357@alumnos.udg.mx'
     and u.email_confirmed_at is not null then 'admin'
    else 'patient'
  end,
  coalesce(u.created_at, now())
from auth.users u
where u.email is not null
on conflict (id) do update set
  email = excluded.email,
  role = case
    when excluded.email = 'gustavo.godoy2357@alumnos.udg.mx'
     and exists (
       select 1 from auth.users u
       where u.id = excluded.id and u.email_confirmed_at is not null
     ) then 'admin'
    else public.profiles.role
  end;

alter table public.profiles enable row level security;
alter table public.measurements enable row level security;
alter table public.appointments enable row level security;

drop policy if exists "profiles_read_self_or_admin" on public.profiles;
create policy "profiles_read_self_or_admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()))
  with check ((id = (select auth.uid()) and role = 'patient') or (select private.is_admin()));

drop policy if exists "measurements_read_self_or_admin" on public.measurements;
create policy "measurements_read_self_or_admin" on public.measurements
  for select to authenticated
  using (patient_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "measurements_insert_self" on public.measurements;
create policy "measurements_insert_self" on public.measurements
  for insert to authenticated
  with check (patient_id = (select auth.uid()));

drop policy if exists "appointments_read_self_or_admin" on public.appointments;
create policy "appointments_read_self_or_admin" on public.appointments
  for select to authenticated
  using (patient_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "appointments_insert_self" on public.appointments;
create policy "appointments_insert_self" on public.appointments
  for insert to authenticated
  with check (
    patient_id = (select auth.uid())
    and status = 'pendiente'
    and scheduled_at > now()
  );

drop policy if exists "appointments_update_self_or_admin" on public.appointments;
create policy "appointments_update_self_or_admin" on public.appointments
  for update to authenticated
  using (patient_id = (select auth.uid()) or (select private.is_admin()))
  with check (
    (patient_id = (select auth.uid()) and status = 'cancelada')
    or (select private.is_admin())
  );

revoke all on public.profiles, public.measurements, public.appointments from anon, authenticated;
grant select on public.profiles, public.measurements, public.appointments to authenticated;
grant update (full_name, birth_date, phone, nutritional_goal)
  on public.profiles to authenticated;
grant insert (patient_id, weight_kg, height_cm, bmi, systolic, diastolic, heart_rate)
  on public.measurements to authenticated;
grant insert (patient_id, scheduled_at, reason)
  on public.appointments to authenticated;
grant update (status) on public.appointments to authenticated;
