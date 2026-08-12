-- =====================================================
-- SBIMS Attendance Management (FR-07)
-- =====================================================

create table public.attendance_records (

    id uuid primary key
        default gen_random_uuid(),

    internship_id uuid not null
        references public.internships(id)
        on delete cascade,

    attendance_date date not null,

    time_in time not null,

    time_out time not null,

    validation_status text not null
        default 'pending',

    validated_by uuid
        references public.profiles(id)
        on delete set null,

    validated_at timestamptz,

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now(),

    constraint attendance_validation_status_check
        check (
            validation_status in (
                'pending',
                'validated',
                'rejected'
            )
        ),

    constraint attendance_time_range_check
        check (
            time_out > time_in
        ),

    constraint attendance_one_record_per_day
        unique (
            internship_id,
            attendance_date
        )
);

-- =====================================================
-- Indexes
-- =====================================================

create index attendance_records_internship_id_idx
on public.attendance_records(internship_id);

create index attendance_records_date_idx
on public.attendance_records(attendance_date);

create index attendance_records_validation_status_idx
on public.attendance_records(validation_status);

create index attendance_records_validated_by_idx
on public.attendance_records(validated_by);

-- =====================================================
-- Row Level Security
-- =====================================================

alter table public.attendance_records
enable row level security;

-- Students can view their own attendance records.
create policy "students can view own attendance"
on public.attendance_records
for select
to authenticated
using (
    exists (
        select 1
        from public.internships i
        join public.profiles p
            on p.id = auth.uid()
        where i.id = attendance_records.internship_id
        and i.student_id = auth.uid()
        and p.role = 'student'
        and p.is_active = true
    )
);

-- Students can create attendance records for their own internship.
create policy "students can create own attendance"
on public.attendance_records
for insert
to authenticated
with check (
    exists (
        select 1
        from public.internships i
        join public.profiles p
            on p.id = auth.uid()
        where i.id = attendance_records.internship_id
        and i.student_id = auth.uid()
        and i.status = 'active'
        and p.role = 'student'
        and p.is_active = true
    )
);

-- Internship coordinators can manage attendance records.
create policy "coordinators can manage attendance"
on public.attendance_records
for all
to authenticated
using (
    exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
        and p.role = 'internship_coordinator'
        and p.is_active = true
    )
)
with check (
    exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
        and p.role = 'internship_coordinator'
        and p.is_active = true
    )
);

-- =====================================================
-- Updated Timestamp
-- =====================================================

drop trigger if exists attendance_records_updated_at_trigger
on public.attendance_records;

create trigger attendance_records_updated_at_trigger

before update

on public.attendance_records

for each row

execute function public.update_updated_at_column();

-- =====================================================
-- Service Role Access
-- =====================================================

grant all privileges
on table public.attendance_records
to service_role;