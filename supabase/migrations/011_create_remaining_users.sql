-- =====================================================
-- CREATE REMAINING USERS MIGRATION
-- Creates auth.users for anyone EXCEPT '김경신', '백송희', '박민규'
-- Default password: 'newstart'
-- =====================================================

-- Ensure search path
SET search_path = public, extensions;

-- Enable pgcrypto
create extension if not exists "pgcrypto";

-- Function to create user SAFELY (omitting instance_id)
create or replace function create_user_if_not_exists(
    _email text,
    _password text,
    _name text
) returns void as $$
declare
    _user_id uuid;
    _encrypted_pw text;
begin
    -- 1. Check if user already exists
    if exists (select 1 from auth.users where email = _email) then
        return; -- Skip if exists
    end if;

    -- 2. Generate UUID and encrypt password
    _user_id := gen_random_uuid();
    -- Use public.gen_salt if extensions schema is not in path, but we set search_path above
    _encrypted_pw := crypt(_password, gen_salt('bf'));

    -- 3. Insert into auth.users (Minimal columns to avoid 500 error)
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
        jsonb_build_object('name', _name), -- This sets the user_metadata properly
        false,
        ''
    );

    -- 4. Insert into auth.identities
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

-- Execute for remaining users
-- We exclude the 3 users you already manually created
DO $$
BEGIN
    -- C-Level & Admin
    -- 김경신 (Already created)
    PERFORM create_user_if_not_exists('hongtack.kim@paulus.pro', 'newstart', '김홍탁');
    PERFORM create_user_if_not_exists('kwangsoo.kim@paulus.pro', 'newstart', '김광수');

    -- Management
    PERFORM create_user_if_not_exists('seungche.jeong@paulus.pro', 'newstart', '정승채');
    PERFORM create_user_if_not_exists('inha.pyo@paulus.pro', 'newstart', '표인하');
    PERFORM create_user_if_not_exists('minhyuk.go@paulus.pro', 'newstart', '고민혁');

    -- Production
    PERFORM create_user_if_not_exists('john.jang@paulus.pro', 'newstart', '장요한');
    -- 박민규 (Already created)
    PERFORM create_user_if_not_exists('hyuk.lim@paulus.pro', 'newstart', '임혁');
    PERFORM create_user_if_not_exists('jeongheon.lee@paulus.pro', 'newstart', '이정헌');
    PERFORM create_user_if_not_exists('wonjun.hong@paulus.pro', 'newstart', '홍원준');
    -- 백송희 (Already created)
    PERFORM create_user_if_not_exists('sanghyeon.han@paulus.pro', 'newstart', '한상현');
    PERFORM create_user_if_not_exists('hyunjin.kim@paulus.pro', 'newstart', '김현진');
    PERFORM create_user_if_not_exists('tiago.sousa@paulus.pro', 'newstart', '티아고 소우자');
    PERFORM create_user_if_not_exists('jiwoo.lee@paulus.pro', 'newstart', '이지우');
    PERFORM create_user_if_not_exists('seol.kwon@paulus.pro', 'newstart', '권설');
    PERFORM create_user_if_not_exists('hyunghwa.jung@paulus.pro', 'newstart', '정형화');
    PERFORM create_user_if_not_exists('kibae.kim@paulus.pro', 'newstart', '김기배');

    -- Creative Solution
    PERFORM create_user_if_not_exists('saffaan.qadir@paulus.pro', 'newstart', '사판 카디르');
    PERFORM create_user_if_not_exists('jimin.ahn@paulus.pro', 'newstart', '안지민');
    PERFORM create_user_if_not_exists('jisoo.lee@paulus.pro', 'newstart', '이지수');
    PERFORM create_user_if_not_exists('bomee.lee@paulus.pro', 'newstart', '이봄이');
    PERFORM create_user_if_not_exists('jaeyoung.jung@paulus.pro', 'newstart', '정재영');

END $$;
