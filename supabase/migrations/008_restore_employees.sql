-- =====================================================
-- RESTORE EMPLOYEES MIGRATION
-- Restores all 24 employees, departments, and salary grades
-- based on src/mock/adminData.ts
-- =====================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Departments Table
create table if not exists nexus_departments (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  color text, 
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Employees Table
create table if not exists nexus_employees (
  id uuid primary key default uuid_generate_v4(),
  employee_no integer unique, 
  name text not null,
  email text,
  phone text,
  status text default '재직중', 
  join_date date,
  department text, 
  team text,
  position text, 
  category text, 
  level text, 
  class_level text, 
  annual_salary numeric,
  monthly_salary numeric,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Salary Grades Table
create table if not exists nexus_salary_grades (
  id uuid primary key default uuid_generate_v4(),
  category text not null, 
  level text not null, 
  class_level text not null, 
  annual_salary numeric not null,
  monthly_salary numeric not null,
  hourly_wage numeric,
  base_salary numeric,
  fixed_overtime numeric,
  meal_allowance numeric,
  probation_salary numeric,
  promotion_condition text,
  tenure_requirement text,
  experience_requirement text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table nexus_departments enable row level security;
alter table nexus_employees enable row level security;
alter table nexus_salary_grades enable row level security;

-- Policies (Public Read / Auth Write)
do $$ 
begin
    if not exists (select 1 from pg_policies where policyname = 'Allow public read access' and tablename = 'nexus_departments') then
        create policy "Allow public read access" on nexus_departments for select using (true);
    end if;
    if not exists (select 1 from pg_policies where policyname = 'Allow public read access' and tablename = 'nexus_employees') then
        create policy "Allow public read access" on nexus_employees for select using (true);
    end if;
    if not exists (select 1 from pg_policies where policyname = 'Allow public read access' and tablename = 'nexus_salary_grades') then
        create policy "Allow public read access" on nexus_salary_grades for select using (true);
    end if;

    if not exists (select 1 from pg_policies where policyname = 'Allow authenticated insert' and tablename = 'nexus_departments') then
        create policy "Allow authenticated insert" on nexus_departments for insert with check (auth.role() = 'authenticated');
    end if;
    if not exists (select 1 from pg_policies where policyname = 'Allow authenticated update' and tablename = 'nexus_departments') then
        create policy "Allow authenticated update" on nexus_departments for update using (auth.role() = 'authenticated');
    end if;
    if not exists (select 1 from pg_policies where policyname = 'Allow authenticated delete' and tablename = 'nexus_departments') then
        create policy "Allow authenticated delete" on nexus_departments for delete using (auth.role() = 'authenticated');
    end if;

    if not exists (select 1 from pg_policies where policyname = 'Allow authenticated insert' and tablename = 'nexus_employees') then
        create policy "Allow authenticated insert" on nexus_employees for insert with check (auth.role() = 'authenticated');
    end if;
    if not exists (select 1 from pg_policies where policyname = 'Allow authenticated update' and tablename = 'nexus_employees') then
        create policy "Allow authenticated update" on nexus_employees for update using (auth.role() = 'authenticated');
    end if;
    if not exists (select 1 from pg_policies where policyname = 'Allow authenticated delete' and tablename = 'nexus_employees') then
        create policy "Allow authenticated delete" on nexus_employees for delete using (auth.role() = 'authenticated');
    end if;

    if not exists (select 1 from pg_policies where policyname = 'Allow authenticated insert' and tablename = 'nexus_salary_grades') then
        create policy "Allow authenticated insert" on nexus_salary_grades for insert with check (auth.role() = 'authenticated');
    end if;
    if not exists (select 1 from pg_policies where policyname = 'Allow authenticated update' and tablename = 'nexus_salary_grades') then
        create policy "Allow authenticated update" on nexus_salary_grades for update using (auth.role() = 'authenticated');
    end if;
    if not exists (select 1 from pg_policies where policyname = 'Allow authenticated delete' and tablename = 'nexus_salary_grades') then
        create policy "Allow authenticated delete" on nexus_salary_grades for delete using (auth.role() = 'authenticated');
    end if;
end $$;

-- SEED DATA
-- Insert Departments
insert into nexus_departments (name, color) values
('Management', 'bg-blue-100'),
('Production', 'bg-green-100'),
('Creative Solution', 'bg-purple-100'),
('Future Strategy', 'bg-orange-100'),
('Media / A&R', 'bg-pink-100'),
('Renatus', 'bg-indigo-100')
ON CONFLICT (name) DO NOTHING;

-- Insert Salary Grades
insert into nexus_salary_grades (category, level, class_level, annual_salary, monthly_salary, hourly_wage, base_salary, fixed_overtime, meal_allowance, probation_salary, promotion_condition, tenure_requirement, experience_requirement) values
-- DIRECTOR
('DIRECTOR', 'D1', '-', 80000000, 6666670, 27057, 5654951, 811715, 200000, 6000000, '', '', ''),

-- LEADER L2
('LEADER', 'L2', 'E', 79900000, 6658340, 27022, 5647664, 810669, 200000, 6012500, '승직가능', '기본 1년 (상시가능)', '7년 이상 10년 미만'),
('LEADER', 'L2', 'D', 77425000, 6452090, 26159, 5467303, 784780, 200000, 5826875, '', '', ''),
('LEADER', 'L2', 'C', 74950000, 6245840, 25296, 5286942, 758891, 200000, 5641250, '', '', ''),
('LEADER', 'L2', 'B', 72475000, 6039590, 24433, 5106581, 733002, 200000, 5455625, '', '', ''),
('LEADER', 'L2', 'A', 70000000, 5833340, 23570, 4926220, 707113, 200000, 5270000, '', '', ''),

-- LEADER L1
('LEADER', 'L1', 'E', 69900000, 5825000, 23536, 4918933, 706067, 200000, 5262500, '승직가능', '1년마다 연봉협상', '5년 이상 7년 미만'),
('LEADER', 'L1', 'D', 67425000, 5618750, 22673, 4738572, 680178, 200000, 5076875, '', '', ''),
('LEADER', 'L1', 'C', 64950000, 5412500, 21810, 4558211, 654289, 200000, 4891250, '', '', ''),
('LEADER', 'L1', 'B', 62475000, 5206250, 20947, 4377850, 628400, 200000, 4705625, '', '', ''),
('LEADER', 'L1', 'A', 60000000, 5000000, 20084, 4197490, 602510, 200000, 4520000, '', '', ''),

-- SENIOR S2
('SENIOR', 'S2', 'E', 59900000, 4991670, 20049, 4190202, 601464, 200000, 4512500, 'P4-A~C로 가능', '1년마다 연봉협상', '4년 이상 5년 미만'),
('SENIOR', 'S2', 'D', 57425000, 4785420, 19186, 4009841, 575575, 200000, 4326875, '', '', ''),
('SENIOR', 'S2', 'C', 54950000, 4579170, 18323, 3829480, 549686, 200000, 4141250, '', '', ''),
('SENIOR', 'S2', 'B', 52475000, 4372920, 17460, 3649120, 523797, 200000, 3955625, '승직불가', '', ''),
('SENIOR', 'S2', 'A', 50000000, 4166670, 16597, 3468759, 497908, 200000, 3770000, '', '3년 이상 4년 미만', ''),

-- SENIOR S1
('SENIOR', 'S1', 'E', 49900000, 4158340, 16562, 3461471, 496862, 200000, 3762500, '', '1년마다 연봉협상', ''),
('SENIOR', 'S1', 'D', 47425000, 3952090, 15699, 3281111, 470973, 200000, 3576875, 'P3-A~C로 가능', '', ''),
('SENIOR', 'S1', 'C', 44950000, 3745840, 14836, 3100750, 445084, 200000, 3391250, '', '1년마다 연봉협상', '2년 이상 3년 미만'),
('SENIOR', 'S1', 'B', 42475000, 3539590, 13973, 2920389, 419195, 200000, 3205625, '승직불가', '', ''),
('SENIOR', 'S1', 'A', 40000000, 3333340, 13110, 2740028, 393305, 200000, 3020000, '', '', ''),

-- JUNIOR P1
('JUNIOR', 'P1', 'E', 39900000, 3325000, 13075, 2732741, 392259, 200000, 3012500, 'P2-A~C로 가능', '상시적으로 연봉통보 (또는 1년주기)', '1년 이상 2년 미만'),
('JUNIOR', 'P1', 'D', 38675000, 3222920, 12648, 2643471, 379446, 200000, 2920625, '', '', ''),
('JUNIOR', 'P1', 'C', 37450000, 3120840, 12221, 2554202, 366632, 200000, 2828750, '', '', ''),
('JUNIOR', 'P1', 'B', 36225000, 3018750, 11794, 2464932, 353818, 200000, 2736875, '승직불가', '', ''),
('JUNIOR', 'P1', 'A', 35000000, 2916670, 11367, 2375662, 341004, 200000, 2645000, '', '', ''),

-- JUNIOR P
('JUNIOR', 'P', 'E', 34900000, 2908340, 11332, 2368375, 339958, 200000, 2637500, 'P1-A~C로 가능', '상시적으로 연봉통보 (또는 1년주기)', '1년 미만'),
('JUNIOR', 'P', 'D', 34104000, 2842000, 11054, 2310368, 331632, 200000, 2577800, '', '', ''),
('JUNIOR', 'P', 'C', 33308000, 2775670, 10777, 2252361, 323305, 200000, 2518100, '', '', ''),
('JUNIOR', 'P', 'B', 32512000, 2709340, 10499, 2194354, 314979, 200000, 2458400, '승직불가', '', ''),
('JUNIOR', 'P', 'A', 31716000, 2643000, 10222, 2136347, 306653, 200000, 2398700, '', '', ''),

-- INTERN
('INTERN', 'Intern', '-', 22080000, 1840000, 10000, 1680000, 0, 160000, 0, 'P-A,B로 가능', '3개월', '')
ON CONFLICT DO NOTHING;

-- Insert 24 Employees
insert into nexus_employees (employee_no, name, status, join_date, department, team, category, position, level, class_level, annual_salary, monthly_salary, phone, email) values
(1, '김경신', '재직중', '2016-02-17', 'Management', '', 'C-lev', 'Chief Executive Officer', 'D1', '-', 111137280, 9261440, '01093090391', ''),
(2, '사판 카디르', '재직중', '2016-07-18', 'Creative Solution', 'Team A', 'Leader', 'Creative Director', 'L2', 'A', 70985000, 5915420, '01029910391', ''),
(3, '장요한', '재직중', '2018-06-01', 'Production', 'Directing', 'Leader', 'Director', 'L1', 'E', 69900000, 5825000, '01067760318', ''),
(4, '박민규', '재직중', '2021-06-01', 'Production', 'Production', 'Leader', 'Producer', 'L1', 'B', 62475000, 5206250, '01025542863', ''),
(5, '임혁', '재직중', '2021-12-01', 'Production', 'Directing', 'Senior', 'Director', 'S1', 'C', 46972750, 3914400, '01091249262', ''),
(6, '이정헌', '재직중', '2022-01-05', 'Production', 'NEXT', 'Senior', '3D Designer', 'S1', 'A', 40000000, 3333340, '01050230483', ''),
(7, '홍원준', '재직중', '2022-04-01', 'Production', 'NEXT', 'Leader', 'Executive Producer', 'L1', 'C', 66010000, 5500840, '01034341916', ''),
(8, '백송희', '재직중', '2022-07-11', 'Production', 'Production', 'Senior', 'Line Producer', 'S1', 'C', 44950000, 3745840, '01080786808', ''),
(9, '정승채', '재직중', '2022-09-01', 'Management', '경영기획실', 'Senior', 'Managing Director', 'S2', 'C', 54950000, 4579170, '01073213025', ''),
(10, '한상현', '재직중', '2024-01-29', 'Production', 'Post Edit', 'Senior', 'Editing Director', 'S1', 'D', 47871750, 3989320, '01077941013', ''),
(11, '김현진', '재직중', '2024-06-01', 'Production', 'Directing', 'Junior', 'Assistant Director', 'P', 'E', 34900000, 2908340, '01053252452', ''),
(12, '안지민', '재직중', '2024-08-01', 'Creative Solution', 'Team A', 'Senior', 'Senior Art Director', 'S1', 'C-', 44000000, 3666670, '01055132209', ''),
(13, '티아고 소우자', '재직중', '2024-10-07', 'Production', 'NEXT', 'Mid', 'Senior 3D Designer', 'S2', 'D', 57420000, 4785000, '01066296632', ''),
(14, '표인하', '재직중', '2024-11-25', 'Management', '경영기획실', 'Senior', 'Finance Manager', 'S1', 'A', 42400000, 3533340, '01038008842', 'ooodj@naver.com'),
(15, '이지수', '재직중', '2025-01-02', 'Creative Solution', 'Team A', 'Junior', 'Art Director', 'P', 'D', 34094700, 2841230, '01067570491', ''),
(16, '이지우', '재직중', '2025-02-03', 'Production', 'Directing', 'Junior', 'Assistant Director', 'P', 'C', 31997880, 2666490, '01091279626', ''),
(17, '고민혁', '재직중', '2025-03-04', 'Management', '경영기획실', 'Junior', 'General Affairs Manager', 'P', 'E', 34000000, 2833340, '01043593087', 'rhalsgurdl@naver.com'),
(18, '이봄이', '재직중', '2025-05-19', 'Creative Solution', 'Team A', 'Senior', 'Creative Manager', 'S1', 'B', 42700000, 3558340, '01073562905', 'bomeelee2@naver.com'),
(19, '정재영', '재직중', '2025-05-26', 'Creative Solution', 'Team B', 'Junior', 'Art Director', 'P', 'A', 31997880, 2666490, '01071359633', 'minhojenny@naver.com'),
(20, '권설', '재직중', '2025-06-02', 'Production', 'NEXT', 'Junior', '3D Designer', 'P1', 'A', 35600000, 2966670, '01040894869', 'ksul0116@gmail.com'),
(21, '정형화', '재직중', '2025-10-13', 'Production', 'Production', 'Junior', 'Line Producer', 'P1', 'C', 38000000, 3166670, '01077666833', 'junghh91@gmail.com'),
(22, '김기배', '재직중', '2025-12-18', 'Production', 'Post Edit', 'Senior', '2D Designer', 'S1', 'D', 47800000, 3983340, '01074502857', 'wrose1202@gmail.com'),
(23, '김홍탁', '재직중', '2025-01-01', 'Creative Solution', '', 'C-lev', 'MASTER', 'D1', '-', 24000000, 2000000, '01072731188', ''),
(24, '김광수', '재직중', '2022-09-01', 'Renatus', '', 'Leader', 'Master Trainer', 'L2', '-', 50400000, 4200000, '01090722391', '')
ON CONFLICT (employee_no) DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  join_date = EXCLUDED.join_date,
  department = EXCLUDED.department,
  team = EXCLUDED.team,
  category = EXCLUDED.category,
  position = EXCLUDED.position,
  level = EXCLUDED.level,
  class_level = EXCLUDED.class_level,
  annual_salary = EXCLUDED.annual_salary,
  monthly_salary = EXCLUDED.monthly_salary,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email;
