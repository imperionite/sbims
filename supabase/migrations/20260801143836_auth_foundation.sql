-- =====================================================
-- SBIMS Authentication Foundation
-- =====================================================
--
-- Handles:
-- - database health check
-- - updated timestamp
-- - password change timestamp
-- - email normalization
--
-- Business authentication logic remains
-- in the backend.
--
-- =====================================================



-- =====================================================
-- Health Check
-- =====================================================


create or replace function public.health_check()

returns boolean

language sql

stable

as $$

select true;

$$;



grant execute

on function public.health_check()

to anon,
authenticated,
service_role;



-- =====================================================
-- Updated Timestamp
-- =====================================================


create or replace function public.update_updated_at_column()

returns trigger

language plpgsql

as $$

begin

    new.updated_at = now();

    return new;

end;

$$;



drop trigger if exists profiles_updated_at_trigger
on public.profiles;



create trigger profiles_updated_at_trigger

before update

on public.profiles

for each row

execute function public.update_updated_at_column();



-- =====================================================
-- Password Change Tracking
-- =====================================================


create or replace function public.track_password_change()

returns trigger

language plpgsql

as $$

begin

    if old.must_change_password = true
       and new.must_change_password = false

    then

        new.last_password_changed_at = now();

    end if;


    return new;

end;

$$;



drop trigger if exists profiles_password_change_trigger
on public.profiles;



create trigger profiles_password_change_trigger

before update

on public.profiles

for each row

execute function public.track_password_change();



-- =====================================================
-- Email Normalization
-- =====================================================


create or replace function public.normalize_profile_email()

returns trigger

language plpgsql

as $$

begin

    new.email = lower(trim(new.email));

    return new;

end;

$$;



drop trigger if exists normalize_profile_email_trigger
on public.profiles;



create trigger normalize_profile_email_trigger

before insert or update

on public.profiles

for each row

execute function public.normalize_profile_email();



-- =====================================================
-- Documentation
-- =====================================================


comment on column public.profiles.last_login_at

is
'Stores the latest successful login timestamp.';


comment on column public.profiles.last_password_changed_at

is
'Stores when the user completed the required password change.';