-- =====================================================
-- SBIMS FR-03
-- Student Profile Database Validation
-- =====================================================

-- -----------------------------------------------------
-- 1. Ensure the table exists with the expected shape
-- -----------------------------------------------------

create table if not exists public.student_profiles (
    id uuid primary key
        references public.profiles(id)
        on delete cascade,

    student_number text not null,

    program text not null,

    year_level integer not null
        check (year_level between 1 and 6),

    section text,

    contact_number text,

    address text,

    emergency_contact_name text,

    emergency_contact_number text,

    internship_status text not null
        default 'pending'
        check (
            internship_status in (
                'pending',
                'active',
                'completed'
            )
        ),

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now()
);


-- -----------------------------------------------------
-- 2. Student number must be unique
-- -----------------------------------------------------

create unique index if not exists
student_profiles_student_number_unique_idx
on public.student_profiles(student_number);


-- -----------------------------------------------------
-- 3. Useful indexes
-- -----------------------------------------------------

create index if not exists
student_profiles_program_idx
on public.student_profiles(program);

create index if not exists
student_profiles_status_idx
on public.student_profiles(internship_status);


-- -----------------------------------------------------
-- 4. Enable RLS
-- -----------------------------------------------------

alter table public.student_profiles
enable row level security;


-- -----------------------------------------------------
-- 5. Remove old FR-03 policies
--
-- This makes the migration deterministic if the
-- policies already exist from the earlier migration.
-- -----------------------------------------------------

drop policy if exists
"students view own student profile"
on public.student_profiles;

drop policy if exists
"staff manage student profiles"
on public.student_profiles;


-- -----------------------------------------------------
-- 6. Students can read only their own profile
-- -----------------------------------------------------

create policy
"students can view own student profile"

on public.student_profiles

for select

to authenticated

using (
    auth.uid() = id
);


-- -----------------------------------------------------
-- 7. Administrators and internship coordinators
--    can manage student profiles.
--
-- This policy intentionally does NOT include
-- faculty_adviser or hte_supervisor.
--
-- Faculty adviser assignment has not been implemented
-- yet, so giving all advisers access here would expose
-- all student records.
-- -----------------------------------------------------

create policy
"staff can manage student profiles"

on public.student_profiles

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


-- -----------------------------------------------------
-- 8. Updated timestamp
-- -----------------------------------------------------

drop trigger if exists
student_profiles_updated_at_trigger
on public.student_profiles;

create trigger
student_profiles_updated_at_trigger

before update

on public.student_profiles

for each row

execute function public.update_updated_at_column();


-- -----------------------------------------------------
-- 9. Explicit service-role privileges
--
-- The backend currently uses supabaseAdmin.
-- Service role bypasses RLS, but explicit privileges
-- make the database contract clear.
-- -----------------------------------------------------

grant all privileges
on table public.student_profiles
to service_role;