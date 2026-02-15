-- Migration 014: Split "기타 수수료 및 비딩 (2025)" into 3 projects
-- and add 박민규, 백송희, 정형화 to all 2025 projects' team_member_ids

-- Step 1: Delete the combined project and its financials
DELETE FROM project_financials WHERE project_id = '10000000-0000-0000-0000-000000000031';
DELETE FROM projects WHERE id = '10000000-0000-0000-0000-000000000031';

-- Step 2: Insert 3 individual projects
INSERT INTO projects (id, title, client, status, type, priority,
  start_date, end_date, description, progress, pm_id, team_member_ids,
  last_activity_at, health_schedule, health_workload, health_budget,
  tasks_completed, tasks_total, budget, key_color)
VALUES
-- 삼성전자 비딩
('10000000-0000-0000-0000-000000000032',
 '삼성전자 비딩', '삼성전자', 'COMPLETED', 'BIDDING', 'MEDIUM',
 '2025-02-01', '2025-03-31', '삼성전자 비딩 프로젝트', 100,
 '00000000-0000-0000-0000-000000000002',
 ARRAY['00000000-0000-0000-0000-000000000002']::UUID[],
 '2025-03-31', 'ON_TRACK', 'BALANCED', 'HEALTHY', 1, 1, 2000000, '#1565C0'),

-- 환경부 중대시민재해방지법 모델 추가계약료
('10000000-0000-0000-0000-000000000033',
 '환경부 중대시민재해방지법 모델 추가계약료', '환경부', 'COMPLETED', 'EXECUTION', 'MEDIUM',
 '2025-02-01', '2025-03-31', '환경부 모델 추가계약료', 100,
 '00000000-0000-0000-0000-000000000002',
 ARRAY['00000000-0000-0000-0000-000000000002']::UUID[],
 '2025-03-31', 'ON_TRACK', 'BALANCED', 'HEALTHY', 1, 1, 3000000, '#2E7D32'),

-- Bdan 런칭캠페인영상 기획비
('10000000-0000-0000-0000-000000000034',
 'Bdan 런칭캠페인영상 기획비', 'Bdan', 'COMPLETED', 'EXECUTION', 'LOW',
 '2025-02-01', '2025-03-31', 'Bdan 런칭캠페인 기획비', 100,
 '00000000-0000-0000-0000-000000000002',
 ARRAY['00000000-0000-0000-0000-000000000002']::UUID[],
 '2025-03-31', 'ON_TRACK', 'BALANCED', 'HEALTHY', 1, 1, 1000000, '#F57C00')
ON CONFLICT (id) DO NOTHING;

-- Step 3: Insert corresponding financials
INSERT INTO project_financials (project_id, contract_amount, expenses, payment_status) VALUES
('10000000-0000-0000-0000-000000000032', 2000000, 0, 'PAID'),
('10000000-0000-0000-0000-000000000033', 3000000, 0, 'PAID'),
('10000000-0000-0000-0000-000000000034', 1000000, 0, 'PAID')
ON CONFLICT (project_id) DO NOTHING;

-- Step 4: Add 박민규 and 백송희 to all 2025 seed projects
-- User UUIDs: 박민규=...0003, 백송희=...0004
DO $$
DECLARE
  proj RECORD;
  minkyu_id UUID := '00000000-0000-0000-0000-000000000003';
  songhee_id UUID := '00000000-0000-0000-0000-000000000004';
  hyunghwa_id UUID;
BEGIN
  -- Look up 정형화's dynamic UUID
  SELECT id INTO hyunghwa_id FROM profiles WHERE name = '정형화' LIMIT 1;

  -- Update all seed projects (IDs matching 10000000-... pattern)
  FOR proj IN
    SELECT id, team_member_ids FROM projects
    WHERE id::text LIKE '10000000-0000-0000-0000-%'
  LOOP
    DECLARE
      new_members UUID[] := COALESCE(proj.team_member_ids, '{}'::UUID[]);
    BEGIN
      -- Add 박민규 if not already present
      IF NOT (minkyu_id = ANY(new_members)) THEN
        new_members := array_append(new_members, minkyu_id);
      END IF;

      -- Add 백송희 if not already present
      IF NOT (songhee_id = ANY(new_members)) THEN
        new_members := array_append(new_members, songhee_id);
      END IF;

      -- Add 정형화 if found and not already present
      IF hyunghwa_id IS NOT NULL AND NOT (hyunghwa_id = ANY(new_members)) THEN
        new_members := array_append(new_members, hyunghwa_id);
      END IF;

      -- Update the project
      UPDATE projects SET team_member_ids = new_members WHERE id = proj.id;
    END;
  END LOOP;
END $$;
