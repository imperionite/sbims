-- =====================================================
-- SBIMS Profile RLS
-- =====================================================


alter table public.profiles
enable row level security;



create policy "users can view own profile"

on public.profiles

for select

to authenticated

using (
    auth.uid() = id
);



create policy "administrators manage profiles"

on public.profiles

for all

to authenticated

using (

    exists (

        select 1
        from public.profiles p

        where p.id = auth.uid()

        and p.role = 'administrator'

    )

)

with check (

    exists (

        select 1
        from public.profiles p

        where p.id = auth.uid()

        and p.role = 'administrator'

    )

);