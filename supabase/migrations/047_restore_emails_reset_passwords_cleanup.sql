-- =====================================================
-- 047: Restore English emails + Reset passwords
--
-- 1. Restore all auth.users emails to English @paulus.pro format
-- 2. Reset all passwords to 'newstart' (except 김경신)
-- =====================================================

SET search_path = public, extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── 1. Restore English emails ──────────────────────────

DO $$
DECLARE
    _mapping RECORD;
BEGIN
    FOR _mapping IN
        SELECT
            au.id AS user_id,
            au.email AS current_email,
            ne.email AS correct_email,
            ne.name
        FROM auth.users au
        JOIN profiles p ON p.id = au.id
        JOIN nexus_employees ne ON ne.name = p.name
        WHERE ne.email IS NOT NULL
          AND ne.email != ''
          AND au.email != ne.email
    LOOP
        RAISE NOTICE 'Restoring email: % → % (user: %)', _mapping.current_email, _mapping.correct_email, _mapping.name;

        UPDATE auth.users
        SET email = _mapping.correct_email, updated_at = now()
        WHERE id = _mapping.user_id;

        UPDATE auth.identities
        SET identity_data = jsonb_set(
                jsonb_set(identity_data, '{email}', to_jsonb(_mapping.correct_email)),
                '{sub}', to_jsonb(_mapping.user_id::text)
            ),
            provider_id = _mapping.correct_email,
            updated_at = now()
        WHERE user_id = _mapping.user_id AND provider = 'email';
    END LOOP;
END $$;

-- ─── 2. Reset passwords to 'newstart' (except 김경신) ───

DO $$
DECLARE
    _user RECORD;
    _encrypted_pw TEXT;
BEGIN
    _encrypted_pw := crypt('newstart', gen_salt('bf'));

    FOR _user IN
        SELECT au.id, au.email, p.name
        FROM auth.users au
        JOIN profiles p ON p.id = au.id
        WHERE p.name != '김경신'
    LOOP
        UPDATE auth.users
        SET encrypted_password = _encrypted_pw, updated_at = now()
        WHERE id = _user.id;

        RAISE NOTICE 'Password reset for: % (%)', _user.name, _user.email;
    END LOOP;
END $$;
