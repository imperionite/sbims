-- =====================================================
-- SBIMS Internship Assignment Relationships
-- =====================================================
--
-- Adds:
-- 1. HTE → HTE Supervisor
-- 2. Internship → Faculty Adviser
--
-- Both relationships are nullable to preserve existing
-- HTE and internship records.
-- =====================================================

alter table public.hte_profiles
add column supervisor_id uuid
    references public.profiles(id)
    on delete set null;

alter table public.internships
add column faculty_adviser_id uuid
    references public.profiles(id)
    on delete set null;

-- =====================================================
-- Indexes
-- =====================================================

create index hte_profiles_supervisor_id_idx
on public.hte_profiles(supervisor_id);

create index internships_faculty_adviser_id_idx
on public.internships(faculty_adviser_id);