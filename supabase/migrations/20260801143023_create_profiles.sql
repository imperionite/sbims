-- =====================================================
-- SBIMS Profiles
-- =====================================================

create table public.profiles (

    id uuid primary key
        references auth.users(id)
        on delete cascade,

    email text not null,

    first_name text not null,

    middle_name text,

    last_name text not null,

    suffix text,


    role text not null
        check (
            role in (
                'administrator',
                'internship_coordinator',
                'faculty_adviser',
                'student',
                'hte_supervisor'
            )
        ),


    is_active boolean
        not null
        default true,


    must_change_password boolean
        not null
        default true,


    created_by uuid
        references auth.users(id),


    last_login_at timestamptz,


    last_password_changed_at timestamptz,


    created_at timestamptz
        not null
        default now(),


    updated_at timestamptz
        not null
        default now()
);



create unique index profiles_email_unique_idx
on public.profiles(lower(email));


create index profiles_role_idx
on public.profiles(role);


create index profiles_active_idx
on public.profiles(is_active);