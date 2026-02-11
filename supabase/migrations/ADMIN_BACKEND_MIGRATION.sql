-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Departments Table
create table if not exists nexus_departments (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  color text, -- For UI badging (e.g., 'bg-blue-100')
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Employees Table
create table if not exists nexus_employees (
  id uuid primary key default uuid_generate_v4(),
  employee_no integer unique, -- 사번
  name text not null,
  email text,
  phone text,
  status text default '재직중', -- '재직중' | '퇴사'
  join_date date,
  
  -- Organization Info
  department text, -- Store as text for simplicity or link to departments
  team text,
  position text, -- 직책 (e.g., Director)
  category text, -- 구분 (e.g., Leader, Senior)
  
  -- Salary Level Info
  level text, -- 직급 (e.g., L1, S1)
  class_level text, -- 호봉 (e.g., A, B)
  
  -- Salary Amount Info (Denormalized for snapshot)
  annual_salary numeric,
  monthly_salary numeric,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Salary Grades Table (For SalaryTable.tsx)
create table if not exists nexus_salary_grades (
  id uuid primary key default uuid_generate_v4(),
  category text not null, -- DIRECTOR, LEADER, SENIOR...
  level text not null, -- D1, L1, S1...
  class_level text not null, -- A, B, C...
  
  -- Amounts
  annual_salary numeric not null,
  monthly_salary numeric not null,
  hourly_wage numeric,
  base_salary numeric,
  fixed_overtime numeric,
  meal_allowance numeric,
  probation_salary numeric,
  
  -- Conditions
  promotion_condition text,
  tenure_requirement text,
  experience_requirement text,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table nexus_departments enable row level security;
alter table nexus_employees enable row level security;
alter table nexus_salary_grades enable row level security;

-- Policies (Open access for now as per instructions to only focus on data structure first, but good practice to have)
create policy "Allow public read access" on nexus_departments for select using (true);
create policy "Allow public read access" on nexus_employees for select using (true);
create policy "Allow public read access" on nexus_salary_grades for select using (true);

-- Admin write access (Assuming authenticated users are admins for now)
create policy "Allow authenticated insert" on nexus_departments for insert with check (auth.role() = 'authenticated');
create policy "Allow authenticated update" on nexus_departments for update using (auth.role() = 'authenticated');
create policy "Allow authenticated delete" on nexus_departments for delete using (auth.role() = 'authenticated');

create policy "Allow authenticated insert" on nexus_employees for insert with check (auth.role() = 'authenticated');
create policy "Allow authenticated update" on nexus_employees for update using (auth.role() = 'authenticated');
create policy "Allow authenticated delete" on nexus_employees for delete using (auth.role() = 'authenticated');

create policy "Allow authenticated insert" on nexus_salary_grades for insert with check (auth.role() = 'authenticated');
create policy "Allow authenticated update" on nexus_salary_grades for update using (auth.role() = 'authenticated');
create policy "Allow authenticated delete" on nexus_salary_grades for delete using (auth.role() = 'authenticated');


-- SEED DATA (Based on Mock Data in component)

-- Insert Departments
insert into nexus_departments (name, color) values
('Management', 'bg-blue-100'),
('Production', 'bg-green-100'),
('Creative Solution', 'bg-purple-100'),
('Future Strategy', 'bg-orange-100'),
('Media / A&R', 'bg-pink-100');

-- Insert Salary Grades (Sample from SalaryTable.tsx)
insert into nexus_salary_grades (category, level, class_level, annual_salary, monthly_salary, hourly_wage, base_salary, fixed_overtime, meal_allowance, probation_salary, promotion_condition, tenure_requirement, experience_requirement) values
('DIRECTOR', 'D1', '-', 111137280, 9261440, 44313, 7061440, 2000000, 200000, 8335296, '개별계약', '-', '15년 이상'),
('LEADER', 'L2', 'A', 70985000, 5915420, 28303, 4415420, 1300000, 200000, 5323878, '성과평가 S', '3년', '12년 이상'),
('LEADER', 'L1', 'E', 69900000, 5825000, 27871, 4425000, 1200000, 200000, 5242500, '성과평가 A', '3년', '9년 이상'),
('SENIOR', 'S1', 'C', 46972750, 3914400, 18729, 3114400, 600000, 200000, 3522960, '-', '-', '5년 이상');
-- (Note: Only inserting a few representative rows for seed. User can add more via UI)

-- Insert Employees (Sample from EmployeeList.tsx)
insert into nexus_employees (employee_no, name, status, join_date, department, team, category, position, level, class_level, annual_salary, monthly_salary, phone) values
(1, '김경신', '재직중', '2016-02-17', 'Management', '', 'C-lev', 'Chief Executive Officer', 'D1', '-', 111137280, 9261440, '01093090391'),
(2, '사판 카디르', '재직중', '2016-07-18', 'Creative Solution', '', 'Leader', 'Creative Director', 'L2', 'A', 70985000, 5915420, '01029910391'),
(3, '장요한', '재직중', '2018-06-01', 'Production', '', 'Leader', 'Director', 'L1', 'E', 69900000, 5825000, '01067760318'),
(4, '박민규', '재직중', '2021-06-01', 'Production', '', 'Senior', 'Producer', 'L1', 'B', 62475000, 5206250, '01025542863'),
(5, '임혁', '재직중', '2021-12-01', 'Production', '', 'Senior', 'Director', 'S1', 'C', 46972750, 3914400, '01091249262'),
(6, '이정헌', '재직중', '2022-01-05', 'Production', '', 'Junior', '3D Designer', 'P1', 'D', 38675000, 3222920, '01050230483');
