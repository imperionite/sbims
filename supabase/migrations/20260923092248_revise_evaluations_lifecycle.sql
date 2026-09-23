-- =====================================================
-- SBIMS Evaluation Management Lifecycle Revision
-- =====================================================
--
-- Evaluation lifecycle remains:
--
--     draft -> submitted
--
-- A draft may be created before final internship eligibility.
-- Final submission remains restricted by InternshipEligibilityService:
--   1. internship period has ended;
--   2. required hours are configured; and
--   3. validated rendered hours meet or exceed required hours.
--
-- Evaluation criteria are fixed by the approved evaluation instrument
-- and represented in the API as criterion_1 through criterion_8.
-- The frontend supplies the human-readable criterion labels.
--
-- No notification/reminder or student-ready flag is introduced here.
-- =====================================================


-- =====================================================
-- 1. Rename the uniqueness constraint to a neutral name.
-- =====================================================

alter table public.evaluations
rename constraint evaluations_unique_hte_supervisor
    to evaluations_unique_evaluator_type;


-- =====================================================
-- 2. Keep HTE Supervisor draft update policy defensive.
-- =====================================================

drop policy if exists "hte supervisors can update own draft evaluations"
on public.evaluations;

create policy "hte supervisors can update own draft evaluations"
on public.evaluations
for update
to authenticated
using (
    evaluator_id = auth.uid()
    and evaluation_type = 'hte_supervisor'
    and status = 'draft'
    and submitted_at is null
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
)
with check (
    evaluator_id = auth.uid()
    and evaluation_type = 'hte_supervisor'
    and status = 'draft'
    and submitted_at is null
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


-- =====================================================
-- 3. Keep Faculty Adviser draft update policy defensive.
-- =====================================================

drop policy if exists "faculty advisers can update own draft evaluations"
on public.evaluations;

create policy "faculty advisers can update own draft evaluations"
on public.evaluations
for update
to authenticated
using (
    evaluator_id = auth.uid()
    and evaluation_type = 'faculty_adviser'
    and status = 'draft'
    and submitted_at is null
    and exists (
        select 1
        from public.internships i
        join public.profiles p
            on p.id = auth.uid()
        where i.id = evaluations.internship_id
        and i.faculty_adviser_id = auth.uid()
        and p.role = 'faculty_adviser'
        and p.is_active = true
    )
)
with check (
    evaluator_id = auth.uid()
    and evaluation_type = 'faculty_adviser'
    and status = 'draft'
    and submitted_at is null
    and exists (
        select 1
        from public.internships i
        join public.profiles p
            on p.id = auth.uid()
        where i.id = evaluations.internship_id
        and i.faculty_adviser_id = auth.uid()
        and p.role = 'faculty_adviser'
        and p.is_active = true
    )
);


-- =====================================================
-- 4. Document the fixed response-key contract.
-- =====================================================

comment on column public.evaluations.responses is
'JSON object containing approved evaluation scores. Supported keys are criterion_1 through criterion_8, each rated 1 through 5. Drafts may be partial; all eight criteria are required before final submission by the application service.';


-- =====================================================
-- 5. Reassert student read behavior.
-- =====================================================
--
-- Students can see only submitted evaluations belonging to their
-- own internship. Draft evaluations remain evaluator-only.

drop policy if exists "students can view own submitted evaluations"
on public.evaluations;

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
