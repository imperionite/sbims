-- =====================================================
-- SBIMS Evaluation Management (FR-08)
-- =====================================================

create table public.evaluations (

    id uuid primary key
        default gen_random_uuid(),

    internship_id uuid not null
        references public.internships(id)
        on delete cascade,

    evaluator_id uuid not null
        references public.profiles(id)
        on delete restrict,

    evaluation_type text not null
        default 'hte_supervisor',

    responses jsonb not null
        default '{}'::jsonb,

    comments text,

    status text not null
        default 'draft',

    submitted_at timestamptz,

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now(),

    constraint evaluations_type_check
        check (
            evaluation_type in (
                'hte_supervisor'
            )
        ),

    constraint evaluations_status_check
        check (
            status in (
                'draft',
                'submitted'
            )
        ),

    constraint evaluations_responses_object_check
        check (
            jsonb_typeof(responses) = 'object'
        ),

    constraint evaluations_submitted_at_check
        check (
            (
                status = 'draft'
                and submitted_at is null
            )
            or
            (
                status = 'submitted'
                and submitted_at is not null
            )
        ),

    constraint evaluations_unique_hte_supervisor
        unique (
            internship_id,
            evaluator_id,
            evaluation_type
        )
);

-- =====================================================
-- Indexes
-- =====================================================

create index evaluations_internship_id_idx
on public.evaluations(internship_id);

create index evaluations_evaluator_id_idx
on public.evaluations(evaluator_id);

create index evaluations_status_idx
on public.evaluations(status);


-- =====================================================
-- Row Level Security
-- =====================================================

alter table public.evaluations
enable row level security;


-- HTE Supervisors can view evaluations associated
-- with their assigned HTE internship.
create policy "hte supervisors can view assigned evaluations"
on public.evaluations
for select
to authenticated
using (
    exists (
        select 1
        from public.internships i
        join public.hte_profiles h
            on h.id = i.hte_id
        join public.profiles p
            on p.id = auth.uid()
        where i.id = evaluations.internship_id
        and h.supervisor_id = auth.uid()
        and p.role = 'hte_supervisor'
        and p.is_active = true
    )
);


-- HTE Supervisors can create evaluations only for
-- internships assigned to their HTE organization.
create policy "hte supervisors can create assigned evaluations"
on public.evaluations
for insert
to authenticated
with check (
    evaluator_id = auth.uid()
    and exists (
        select 1
        from public.internships i
        join public.hte_profiles h
            on h.id = i.hte_id
        join public.profiles p
            on p.id = auth.uid()
        where i.id = evaluations.internship_id
        and h.supervisor_id = auth.uid()
        and p.role = 'hte_supervisor'
        and p.is_active = true
    )
);


-- HTE Supervisors can update their own draft evaluations.
create policy "hte supervisors can update own draft evaluations"
on public.evaluations
for update
to authenticated
using (
    evaluator_id = auth.uid()
    and status = 'draft'
    and exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
        and p.role = 'hte_supervisor'
        and p.is_active = true
    )
)
with check (
    evaluator_id = auth.uid()
    and exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
        and p.role = 'hte_supervisor'
        and p.is_active = true
    )
);


-- Internship coordinators can manage evaluations.
create policy "coordinators can manage evaluations"
on public.evaluations
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


-- Students can view their own submitted evaluation results.
create policy "students can view own submitted evaluations"
on public.evaluations
for select
to authenticated
using (
    status = 'submitted'
    and exists (
        select 1
        from public.internships i
        join public.profiles p
            on p.id = auth.uid()
        where i.id = evaluations.internship_id
        and i.student_id = auth.uid()
        and p.role = 'student'
        and p.is_active = true
    )
);


-- =====================================================
-- Updated Timestamp
-- =====================================================

drop trigger if exists evaluations_updated_at_trigger
on public.evaluations;

create trigger evaluations_updated_at_trigger
before update
on public.evaluations
for each row
execute function public.update_updated_at_column();


-- =====================================================
-- Service Role Access
-- =====================================================

grant all privileges
on table public.evaluations
to service_role;