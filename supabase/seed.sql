-- Seed data for Nexus Planner
-- This file populates the database with initial mock data

-- Note: You'll need to replace these UUIDs with actual user IDs after authentication is set up
-- For now, we'll use placeholder UUIDs

-- ============================================
-- MOCK USER IDS (Replace with real auth.users IDs)
-- ============================================
-- u1: 00000000-0000-0000-0000-000000000001 (Paul Kim - Admin)
-- u2: 00000000-0000-0000-0000-000000000002 (Sarah Chen - Manager)
-- u3: 00000000-0000-0000-0000-000000000003 (James Lee - Member)
-- u4: 00000000-0000-0000-0000-000000000004 (Emily Park - Member)
-- u5: 00000000-0000-0000-0000-000000000005 (David Song - Manager)

-- ============================================
-- PROFILES
-- ============================================
INSERT INTO profiles (id, name, avatar, role, department, work_status) VALUES
('00000000-0000-0000-0000-000000000001', 'Paul Kim', '', 'ADMIN', 'Management', 'NOT_AT_WORK'),
('00000000-0000-0000-0000-000000000002', 'Sarah Chen', '', 'MANAGER', 'Creative', 'NOT_AT_WORK'),
('00000000-0000-0000-0000-000000000003', 'James Lee', '', 'MEMBER', 'Design', 'NOT_AT_WORK'),
('00000000-0000-0000-0000-000000000004', 'Emily Park', '', 'MEMBER', 'Production', 'NOT_AT_WORK'),
('00000000-0000-0000-0000-000000000005', 'David Song', '', 'MANAGER', 'Strategy', 'NOT_AT_WORK')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PROJECTS
-- ============================================
INSERT INTO projects (
  id, title, client, status, type, priority, start_date, end_date, description,
  progress, pm_id, team_member_ids, health_schedule, health_workload, health_budget,
  tasks_completed, tasks_total, budget, currency
) VALUES
(
  'p1',
  'Samsung Galaxy Campaign',
  'Samsung Electronics',
  'ACTIVE',
  'EXECUTION',
  'HIGH',
  NOW() - INTERVAL '30 days',
  NOW() + INTERVAL '30 days',
  'Major campaign for Samsung Galaxy S25 launch',
  65,
  '00000000-0000-0000-0000-000000000001',
  ARRAY['00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003']::UUID[],
  'ON_TRACK',
  'BALANCED',
  'HEALTHY',
  12,
  18,
  500000000,
  'KRW'
),
(
  'p2',
  'Hyundai EV Brand Film',
  'Hyundai Motor',
  'ACTIVE',
  'EXECUTION',
  'HIGH',
  NOW() - INTERVAL '14 days',
  NOW() + INTERVAL '45 days',
  'Brand film for Hyundai EV lineup',
  40,
  '00000000-0000-0000-0000-000000000002',
  ARRAY['00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004']::UUID[],
  'AT_RISK',
  'OVERLOADED',
  'TIGHT',
  8,
  20,
  800000000,
  'KRW'
),
(
  'p3',
  'LG AI Campaign Proposal',
  'LG Electronics',
  'ACTIVE',
  'BIDDING',
  'MEDIUM',
  NOW() - INTERVAL '7 days',
  NOW() + INTERVAL '21 days',
  'Proposal for LG AI product campaign',
  30,
  '00000000-0000-0000-0000-000000000005',
  ARRAY['00000000-0000-0000-0000-000000000002']::UUID[],
  'ON_TRACK',
  'BALANCED',
  'HEALTHY',
  3,
  10,
  200000000,
  'KRW'
),
(
  'p4',
  'SK Telecom 5G Launch',
  'SK Telecom',
  'COMPLETED',
  'EXECUTION',
  'HIGH',
  NOW() - INTERVAL '90 days',
  NOW() - INTERVAL '30 days',
  'Completed 5G service launch campaign',
  100,
  '00000000-0000-0000-0000-000000000001',
  ARRAY['00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004']::UUID[],
  'ON_TRACK',
  'BALANCED',
  'HEALTHY',
  25,
  25,
  600000000,
  'KRW'
),
(
  'p5',
  'Naver Cloud Platform',
  'Naver',
  'ACTIVE',
  'BIDDING',
  'LOW',
  NOW() - INTERVAL '3 days',
  NOW() + INTERVAL '14 days',
  'Concept development for Naver Cloud',
  20,
  '00000000-0000-0000-0000-000000000005',
  ARRAY['00000000-0000-0000-0000-000000000003']::UUID[],
  'ON_TRACK',
  'BALANCED',
  'HEALTHY',
  8,
  12,
  350000000,
  'KRW'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PROJECT MILESTONES
-- ============================================
INSERT INTO project_milestones (project_id, title, completed, order_no) VALUES
('p1', 'Concept Approval', true, 1),
('p1', 'Production', true, 2),
('p1', 'Post-Production', false, 3),
('p1', 'Final Delivery', false, 4),
('p2', 'Script Development', true, 1),
('p2', 'Pre-Production', true, 2),
('p2', 'Filming', false, 3),
('p2', 'Post-Production', false, 4),
('p3', 'Research', true, 1),
('p3', 'Proposal', false, 2),
('p4', 'Planning', true, 1),
('p4', 'Execution', true, 2),
('p4', 'Launch', true, 3),
('p5', 'Concept Development', true, 1),
('p5', 'Client Presentation', false, 2);

-- ============================================
-- CALENDAR EVENTS
-- ============================================
INSERT INTO calendar_events (title, type, start_at, end_at, project_id, owner_id, source) VALUES
('Samsung Kickoff Meeting', 'MEETING', NOW(), NOW() + INTERVAL '1 hour', 'p1', '00000000-0000-0000-0000-000000000001', 'PAULUS'),
('Galaxy Campaign Deadline', 'DEADLINE', NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days', 'p1', '00000000-0000-0000-0000-000000000001', 'PAULUS'),
('Hyundai Storyboard Review', 'MEETING', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day' + INTERVAL '2 hours', 'p2', '00000000-0000-0000-0000-000000000002', 'PAULUS'),
('LG Proposal Presentation', 'PT', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days' + INTERVAL '1 hour', 'p3', '00000000-0000-0000-0000-000000000005', 'PAULUS'),
('Final Delivery - Samsung', 'DELIVERY', NOW() + INTERVAL '30 days', NOW() + INTERVAL '30 days', 'p1', '00000000-0000-0000-0000-000000000001', 'PAULUS'),
('Team Sync', 'MEETING', NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days' + INTERVAL '30 minutes', NULL, '00000000-0000-0000-0000-000000000001', 'PAULUS'),
('Hyundai EV Film - Script Finalization', 'TASK', NOW() + INTERVAL '4 days', NOW() + INTERVAL '6 days', 'p2', '00000000-0000-0000-0000-000000000002', 'PAULUS');

-- ============================================
-- CHAT MESSAGES
-- ============================================
INSERT INTO chat_messages (project_id, user_id, content, created_at) VALUES
('p1', '00000000-0000-0000-0000-000000000001', 'Just uploaded the latest campaign deck for review', NOW() - INTERVAL '1 day'),
('p1', '00000000-0000-0000-0000-000000000002', 'Thanks! Will review and provide feedback by EOD', NOW() - INTERVAL '23 hours'),
('p1', '00000000-0000-0000-0000-000000000003', 'Design assets are ready for the next phase', NOW() - INTERVAL '12 hours'),
('p2', '00000000-0000-0000-0000-000000000002', 'Client approved the storyboard! Moving to production', NOW() - INTERVAL '2 hours'),
('p2', '00000000-0000-0000-0000-000000000004', 'Great news! I''ll coordinate with the production team', NOW() - INTERVAL '1 hour');

-- ============================================
-- FILE GROUPS
-- ============================================
INSERT INTO file_groups (id, project_id, category, title) VALUES
('fg1', 'p1', 'DECK', 'Campaign Decks'),
('fg2', 'p1', 'FINAL', 'Final Deliverables'),
('fg3', 'p1', 'CONTRACT', 'Contracts'),
('fg4', 'p2', 'DECK', 'Storyboards'),
('fg5', 'p2', 'CONTRACT', 'Client Contracts'),
('fg6', 'p3', 'REFERENCE', 'Brand Guidelines');

-- ============================================
-- FILE ITEMS
-- ============================================
INSERT INTO file_items (file_group_id, name, uploaded_by, size, type, created_at) VALUES
('fg1', 'Samsung_Galaxy_S25_Campaign_v3.pdf', '00000000-0000-0000-0000-000000000001', '4.2 MB', 'pdf', NOW() - INTERVAL '2 days'),
('fg1', 'Creative_Brief_Final.pdf', '00000000-0000-0000-0000-000000000002', '1.8 MB', 'pdf', NOW() - INTERVAL '5 days'),
('fg2', 'Galaxy_Campaign_Final_Cut.mp4', '00000000-0000-0000-0000-000000000003', '245 MB', 'video', NOW() - INTERVAL '1 day'),
('fg3', 'Samsung_Contract_2025.pdf', '00000000-0000-0000-0000-000000000001', '2.1 MB', 'pdf', NOW() - INTERVAL '30 days'),
('fg4', 'Hyundai_EV_Storyboard_v2.pdf', '00000000-0000-0000-0000-000000000002', '8.7 MB', 'pdf', NOW() - INTERVAL '2 days');

-- ============================================
-- PERFORMANCE SNAPSHOTS
-- ============================================
INSERT INTO performance_snapshots (user_id, period, total_score, financial_score, peer_score, rank, calculated_at) VALUES
('00000000-0000-0000-0000-000000000001', '2025-05', 87, 62, 25, 1, NOW() - INTERVAL '60 days'),
('00000000-0000-0000-0000-000000000001', '2025-06', 89, 64, 25, 1, NOW() - INTERVAL '30 days'),
('00000000-0000-0000-0000-000000000001', '2025-07', 91, 66, 25, 1, NOW()),
('00000000-0000-0000-0000-000000000002', '2025-07', 85, 58, 27, 2, NOW()),
('00000000-0000-0000-0000-000000000003', '2025-07', 78, 52, 26, 3, NOW());

-- ============================================
-- PORTFOLIO ITEMS
-- ============================================
INSERT INTO portfolio_items (user_id, project_id, project_title, client, role, completed_at) VALUES
('00000000-0000-0000-0000-000000000001', 'p4', 'SK Telecom 5G Launch', 'SK Telecom', 'Creative Director', NOW() - INTERVAL '30 days'),
('00000000-0000-0000-0000-000000000002', 'p4', 'SK Telecom 5G Launch', 'SK Telecom', 'Producer', NOW() - INTERVAL '30 days'),
('00000000-0000-0000-0000-000000000003', 'p4', 'SK Telecom 5G Launch', 'SK Telecom', 'Lead Designer', NOW() - INTERVAL '30 days');

-- ============================================
-- PEER FEEDBACK
-- ============================================
INSERT INTO peer_feedback (project_id, from_user_id, to_user_id, rating, comment, created_at) VALUES
('p1', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 5, 'Excellent leadership and vision', NOW() - INTERVAL '15 days'),
('p1', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 5, 'Great project management', NOW() - INTERVAL '15 days'),
('p2', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 4, 'Good collaboration', NOW() - INTERVAL '10 days'),
('p4', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 5, 'Outstanding execution', NOW() - INTERVAL '35 days'),
('p1', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 5, 'Exceptional direction', NOW() - INTERVAL '15 days');

-- ============================================
-- PROJECT CONTRIBUTIONS
-- ============================================
INSERT INTO project_contributions (project_id, user_id, contribution_rate, contribution_value, calculated_at) VALUES
('p1', '00000000-0000-0000-0000-000000000001', 0.35, 17500000, NOW() - INTERVAL '1 day'),
('p1', '00000000-0000-0000-0000-000000000002', 0.30, 15000000, NOW() - INTERVAL '1 day'),
('p1', '00000000-0000-0000-0000-000000000003', 0.35, 17500000, NOW() - INTERVAL '1 day'),
('p2', '00000000-0000-0000-0000-000000000002', 0.40, 32000000, NOW() - INTERVAL '1 day'),
('p2', '00000000-0000-0000-0000-000000000003', 0.30, 24000000, NOW() - INTERVAL '1 day'),
('p2', '00000000-0000-0000-0000-000000000004', 0.30, 24000000, NOW() - INTERVAL '1 day'),
('p2', '00000000-0000-0000-0000-000000000005', 0.30, 24000000, NOW() - INTERVAL '1 day');
