-- =====================================================
-- CREATE USERS MIGRATION (CORRECTED EMAIL LIST & FIX 500 ERROR)
-- 1. Updates nexus_employees with correct emails
-- 2. Creates auth.users (omitting instance_id to use system default)
-- 3. Sets Admin role for Kyungsin Kim
-- =====================================================

-- Ensure we can use pgcrypto functions 
-- (adjust search_path in case extensions schema is used)
SET search_path = public, extensions;

-- Enable pgcrypto extension
create extension if not exists "pgcrypto";

-- Function to create user if not exists
create or replace function create_user_if_not_exists(
    _email text,
    _password text,
    _name text
) returns void as $$
declare
    _user_id uuid;
    _encrypted_pw text;
begin
    -- Check if user already exists
    if exists (select 1 from auth.users where email = _email) then
        return;
    end if;

    -- Generate UUID and encrypt password
    _user_id := gen_random_uuid();
    _encrypted_pw := crypt(_password, gen_salt('bf'));

    -- Insert into auth.users 
    -- IMPORTANT: Omit instance_id so Supabase uses its correct default
    insert into auth.users (
        id,
        role,
        aud,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        confirmation_token
    ) values (
        _user_id,
        'authenticated',
        'authenticated',
        _email,
        _encrypted_pw,
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('name', _name),
        false,
        ''
    );

    -- Insert into auth.identities
    insert into auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    ) values (
        _user_id,
        _user_id,
        jsonb_build_object('sub', _user_id, 'email', _email),
        'email',
        _email,
        now(),
        now(),
        now()
    );
end;
$$ language plpgsql security definer;

-- 1. Update nexus_employees with CORRECT emails (from User Request)
-- C-Level & Admin
UPDATE nexus_employees SET email = 'kyungsin.kim@paulus.pro' WHERE name = '김경신';
UPDATE nexus_employees SET email = 'hongtack.kim@paulus.pro' WHERE name = '김홍탁'; -- Hongtack
UPDATE nexus_employees SET email = 'kwangsoo.kim@paulus.pro' WHERE name = '김광수';

-- Management
UPDATE nexus_employees SET email = 'seungche.jeong@paulus.pro' WHERE name = '정승채';
UPDATE nexus_employees SET email = 'inha.pyo@paulus.pro' WHERE name = '표인하';
UPDATE nexus_employees SET email = 'minhyuk.go@paulus.pro' WHERE name = '고민혁'; -- Minhyuk Go

-- Production
UPDATE nexus_employees SET email = 'john.jang@paulus.pro' WHERE name = '장요한';
UPDATE nexus_employees SET email = 'minkyu.park@paulus.pro' WHERE name = '박민규';
UPDATE nexus_employees SET email = 'hyuk.lim@paulus.pro' WHERE name = '임혁';
UPDATE nexus_employees SET email = 'jeongheon.lee@paulus.pro' WHERE name = '이정헌';
UPDATE nexus_employees SET email = 'wonjun.hong@paulus.pro' WHERE name = '홍원준';
UPDATE nexus_employees SET email = 'songhee.baek@paulus.pro' WHERE name = '백송희';
UPDATE nexus_employees SET email = 'sanghyeon.han@paulus.pro' WHERE name = '한상현';
UPDATE nexus_employees SET email = 'hyunjin.kim@paulus.pro' WHERE name = '김현진';
UPDATE nexus_employees SET email = 'tiago.sousa@paulus.pro' WHERE name = '티아고 소우자';
UPDATE nexus_employees SET email = 'jiwoo.lee@paulus.pro' WHERE name = '이지우';
UPDATE nexus_employees SET email = 'seol.kwon@paulus.pro' WHERE name = '권설';
UPDATE nexus_employees SET email = 'hyunghwa.jung@paulus.pro' WHERE name = '정형화';
UPDATE nexus_employees SET email = 'kibae.kim@paulus.pro' WHERE name = '김기배';

-- Creative Solution
UPDATE nexus_employees SET email = 'saffaan.qadir@paulus.pro' WHERE name = '사판 카디르'; -- Saffaan
UPDATE nexus_employees SET email = 'jimin.ahn@paulus.pro' WHERE name = '안지민';
UPDATE nexus_employees SET email = 'jisoo.lee@paulus.pro' WHERE name = '이지수';
UPDATE nexus_employees SET email = 'bomee.lee@paulus.pro' WHERE name = '이봄이'; -- Bomee
UPDATE nexus_employees SET email = 'jaeyoung.jung@paulus.pro' WHERE name = '정재영';

-- 2. Create Auth Users for all employees with email
do $$
declare
    emp record;
begin
    for emp in select * from nexus_employees where email is not null loop
        perform create_user_if_not_exists(emp.email, 'newstart', emp.name);
    end loop;
end;
$$;

-- 3. Grant ADMIN role to Kyungsin Kim
-- (Updates the profile created by the trigger)
UPDATE profiles 
SET role = 'ADMIN' 
WHERE id IN (
    SELECT id FROM auth.users WHERE email = 'kyungsin.kim@paulus.pro'
);
