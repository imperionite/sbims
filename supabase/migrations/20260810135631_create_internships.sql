-- =====================================================
-- SBIMS Internship Management (FR-05)
-- =====================================================

create table public.internships (

    id uuid primary key
        default gen_random_uuid(),

    student_id uuid not null
        references public.student_profiles(id)
        on delete cascade,

    hte_id uuid not null
        references public.hte_profiles(id)
        on delete restrict,

    status text not null
        default 'pending',

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now(),

    constraint internships_status_check
        check (
            status in (
                'pending',
                'active',
                'completed'
            )
        ),

    constraint internships_student_unique
        unique (student_id)
);

-- =====================================================
-- Indexes
-- =====================================================

create index internships_hte_id_idx
on public.internships(hte_id);

create index internships_status_idx
on public.internships(status);

-- =====================================================
-- Row Level Security
-- =====================================================

alter table public.internships
enable row level security;

-- Students can view their own internship assignment.
create policy "students can view own internship"
on public.internships
for select
to authenticated
using (
    student_id = auth.uid()
    and exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
        and p.role = 'student'
        and p.is_active = true
    )
);

-- Internship administrators and coordinators can
-- manage internship assignments.
create policy "staff can manage internships"
on public.internships
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

drop trigger if exists internships_updated_at_trigger
on public.internships;

create trigger internships_updated_at_trigger

before update

on public.internships

for each row

execute function public.update_updated_at_column();

-- =====================================================
-- Service Role Access
-- =====================================================

grant all privileges
on table public.internships
to service_role;