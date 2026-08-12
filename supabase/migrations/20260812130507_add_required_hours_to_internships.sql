-- =====================================================
-- SBIMS Internship Management (FR-05)
-- Required Internship Hours
-- =====================================================

alter table public.internships
add column required_hours integer;

alter table public.internships
add constraint internships_required_hours_check
check (
    required_hours is null
    or required_hours > 0
);