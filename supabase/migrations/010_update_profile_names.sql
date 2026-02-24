-- =====================================================
-- FIX USER NAMES MIGRATION
-- Updates profiles.name from 'New User' to real names
-- based on email addresses.
-- =====================================================

-- Helper function to update profile name by email
-- (This makes the script cleaner/safer to run)
DO $$
DECLARE
    -- No variables needed for this simple block
BEGIN
    -- 1. C-Level & Admin
    UPDATE profiles SET name = '김경신', role = 'ADMIN' 
    FROM auth.users WHERE profiles.id = auth.users.id AND auth.users.email = 'kyungsin.kim@paulus.pro';

    UPDATE profiles SET name = '김홍탁' 
    FROM auth.users WHERE profiles.id = auth.users.id AND auth.users.email = 'hongtack.kim@paulus.pro';

    UPDATE profiles SET name = '김광수' 
    FROM auth.users WHERE profiles.id = auth.users.id AND auth.users.email = 'kwangsoo.kim@paulus.pro';

    -- 2. Management
    UPDATE profiles SET name = '정승채' 
    FROM auth.users WHERE profiles.id = auth.users.id AND auth.users.email = 'seungche.jeong@paulus.pro';

    UPDATE profiles SET name = '표인하' 
    FROM auth.users WHERE profiles.id = auth.users.id AND auth.users.email = 'inha.pyo@paulus.pro';

    UPDATE profiles SET name = '고민혁' 
    FROM auth.users WHERE profiles.id = auth.users.id AND auth.users.email = 'minhyuk.go@paulus.pro';

    -- 3. Production
    UPDATE profiles SET name = '장요한' 
    FROM auth.users WHERE profiles.id = auth.users.id AND auth.users.email = 'john.jang@paulus.pro';

    UPDATE profiles SET name = '박민규' 
    FROM auth.users WHERE profiles.id = auth.users.id AND auth.users.email = 'minkyu.park@paulus.pro';

    UPDATE profiles SET name = '임혁' 
    FROM auth.users WHERE profiles.id = auth.users.id AND auth.users.email = 'hyuk.lim@paulus.pro';

    UPDATE profiles SET name = '이정헌' 
    FROM auth.users WHERE profiles.id = auth.users.id AND auth.users.email = 'jeongheon.lee@paulus.pro';

    UPDATE profiles SET name = '홍원준' 
    FROM auth.users WHERE profiles.id = auth.users.id AND auth.users.email = 'wonjun.hong@paulus.pro';

    UPDATE profiles SET name = '백송희' 
    FROM auth.users WHERE profiles.id = auth.users.id AND auth.users.email = 'songhee.baek@paulus.pro';

    UPDATE profiles SET name = '한상현' 
    FROM auth.users WHERE profiles.id = auth.users.id AND auth.users.email = 'sanghyeon.han@paulus.pro';

    UPDATE profiles SET name = '김현진' 
    FROM auth.users WHERE profiles.id = auth.users.id AND auth.users.email = 'hyunjin.kim@paulus.pro';

    UPDATE profiles SET name = '티아고 소우자' 
    FROM auth.users WHERE profiles.id = auth.users.id AND auth.users.email = 'tiago.sousa@paulus.pro';

    UPDATE profiles SET name = '이지우' 
    FROM auth.users WHERE profiles.id = auth.users.id AND auth.users.email = 'jiwoo.lee@paulus.pro';

    UPDATE profiles SET name = '권설' 
    FROM auth.users WHERE profiles.id = auth.users.id AND auth.users.email = 'seol.kwon@paulus.pro';

    UPDATE profiles SET name = '정형화' 
    FROM auth.users WHERE profiles.id = auth.users.id AND auth.users.email = 'hyunghwa.jung@paulus.pro';

    UPDATE profiles SET name = '김기배' 
    FROM auth.users WHERE profiles.id = auth.users.id AND auth.users.email = 'kibae.kim@paulus.pro';

    -- 4. Creative Solution
    UPDATE profiles SET name = '사판 카디르' 
    FROM auth.users WHERE profiles.id = auth.users.id AND auth.users.email = 'saffaan.qadir@paulus.pro';

    UPDATE profiles SET name = '안지민' 
    FROM auth.users WHERE profiles.id = auth.users.id AND auth.users.email = 'jimin.ahn@paulus.pro';

    UPDATE profiles SET name = '이지수' 
    FROM auth.users WHERE profiles.id = auth.users.id AND auth.users.email = 'jisoo.lee@paulus.pro';

    UPDATE profiles SET name = '이봄이' 
    FROM auth.users WHERE profiles.id = auth.users.id AND auth.users.email = 'bomee.lee@paulus.pro';

    UPDATE profiles SET name = '정재영' 
    FROM auth.users WHERE profiles.id = auth.users.id AND auth.users.email = 'jaeyoung.jung@paulus.pro';

END $$;

-- 5. Also Ensure Nexus Employees table has the emails 
-- (In case previous migration was skipped)
UPDATE nexus_employees SET email = 'kyungsin.kim@paulus.pro' WHERE name = '김경신';
UPDATE nexus_employees SET email = 'hongtack.kim@paulus.pro' WHERE name = '김홍탁';
UPDATE nexus_employees SET email = 'kwangsoo.kim@paulus.pro' WHERE name = '김광수';
UPDATE nexus_employees SET email = 'seungche.jeong@paulus.pro' WHERE name = '정승채';
UPDATE nexus_employees SET email = 'inha.pyo@paulus.pro' WHERE name = '표인하';
UPDATE nexus_employees SET email = 'minhyuk.go@paulus.pro' WHERE name = '고민혁';
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
UPDATE nexus_employees SET email = 'saffaan.qadir@paulus.pro' WHERE name = '사판 카디르';
UPDATE nexus_employees SET email = 'jimin.ahn@paulus.pro' WHERE name = '안지민';
UPDATE nexus_employees SET email = 'jisoo.lee@paulus.pro' WHERE name = '이지수';
UPDATE nexus_employees SET email = 'bomee.lee@paulus.pro' WHERE name = '이봄이';
UPDATE nexus_employees SET email = 'jaeyoung.jung@paulus.pro' WHERE name = '정재영';
