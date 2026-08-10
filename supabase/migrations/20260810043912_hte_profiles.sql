-- =====================================================
-- SBIMS HTE Profiles (FR-04)
-- =====================================================

create table public.hte_profiles (

    id uuid primary key
        default gen_random_uuid(),

    company_name text not null,

    address text not null,

    contact_person text not null,

    contact_email text,

    contact_number text,

    is_active boolean
        not null
        default true,

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now()
);

-- =====================================================
-- Indexes
-- =====================================================

create index hte_profiles_company_name_idx
on public.hte_profiles(company_name);

create index hte_profiles_active_idx
on public.hte_profiles(is_active);

-- =====================================================
-- Row Level Security
-- =====================================================

alter table public.hte_profiles
enable row level security;

-- =====================================================
-- HTE Management
-- =====================================================
-- Administrators and internship coordinators can
-- create, view, update, and deactivate HTE profiles.
--
-- Other authenticated users do not receive direct
-- access to HTE management through these policies.

create policy "staff can manage HTE profiles"

on public.hte_profiles

for all

to authenticated

using (
    exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
        and p.role in (
            'administrator',
            'internship_coordinator'
        )
        and p.is_active = true
    )
)

with check (
    exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
        and p.role in (
            'administrator',
            'internship_coordinator'
        )
        and p.is_active = true
    )
);

-- =====================================================
-- Updated Timestamp
-- =====================================================

drop trigger if exists hte_profiles_updated_at_trigger
on public.hte_profiles;

create trigger hte_profiles_updated_at_trigger

before update

on public.hte_profiles

for each row

execute function public.update_updated_at_column();

-- =====================================================
-- Service Role Access
-- =====================================================
-- The backend uses supabaseAdmin, which uses the
-- service role. Explicit privileges make the database
-- contract clear.

grant all privileges
on table public.hte_profiles
to service_role;
