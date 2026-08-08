-- =====================================================
-- SBIMS Student Profiles (FR-03)
-- =====================================================

create table public.student_profiles (

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


-- =====================================================
-- Indexes
-- =====================================================

create unique index student_profiles_student_number_unique_idx
on public.student_profiles(student_number);


create index student_profiles_program_idx
on public.student_profiles(program);


create index student_profiles_status_idx
on public.student_profiles(internship_status);



-- =====================================================
-- RLS
-- =====================================================

alter table public.student_profiles
enable row level security;



-- Student can view own record
create policy "students view own student profile"

on public.student_profiles

for select

to authenticated

using (
    auth.uid() = id
);



-- Administrators and coordinators manage students
create policy "staff manage student profiles"

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

    )

);



-- =====================================================
-- Updated timestamp
-- =====================================================

create trigger student_profiles_updated_at_trigger

before update

on public.student_profiles

for each row

execute function public.update_updated_at_column();



-- =====================================================
-- Service role access
-- =====================================================

grant all privileges
on table public.student_profiles
to service_role;