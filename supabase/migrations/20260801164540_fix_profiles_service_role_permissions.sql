-- Allow backend admin operations on profiles

grant all privileges
on table public.profiles
to service_role;


grant usage, select
on all sequences
in schema public
to service_role;