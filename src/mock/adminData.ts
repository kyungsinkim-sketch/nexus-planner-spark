/**
 * CONFIDENTIAL - 파울러스 HR 마스터 시트 기반 목데이터
 * 보안등급 2 - 경영실_파울러스_HR_마스터_시트 (ver.2025.12.18)
 */
import type { AdminEmployee, AdminSalaryGrade } from '@/types/admin';

// ============================================
// 재직 임직원 목록 (24명)
// ============================================
export const mockEmployees: AdminEmployee[] = [
  {
    id: 'emp-1', employee_no: 1, name: '김경신', status: '재직중',
    join_date: '2016-02-17', department: 'Management', team: '',
    position: 'Chief Executive Officer', category: 'C-lev',
    level: 'D1', class_level: '-',
    annual_salary: 111137280, monthly_salary: 9261440,
    phone: '01093090391', email: 'kyungsin.kim@paulus.pro',
  },
  {
    id: 'emp-2', employee_no: 2, name: '사판 카디르', status: '재직중',
    join_date: '2016-07-18', department: 'Creative Solution', team: 'Team A',
    position: 'Creative Director', category: 'Leader',
    level: 'L2', class_level: 'A',
    annual_salary: 70985000, monthly_salary: 5915420,
    phone: '01029910391', email: 'sapan.kadir@paulus.pro',
  },
  {
    id: 'emp-3', employee_no: 3, name: '장요한', status: '재직중',
    join_date: '2018-06-01', department: 'Production', team: 'Directing',
    position: 'Director', category: 'Leader',
    level: 'L1', class_level: 'E',
    annual_salary: 69900000, monthly_salary: 5825000,
    phone: '01067760318', email: 'john.jang@paulus.pro',
  },
  {
    id: 'emp-4', employee_no: 4, name: '박민규', status: '재직중',
    join_date: '2021-06-01', department: 'Production', team: 'Production',
    position: 'Producer', category: 'Leader',
    level: 'L1', class_level: 'B',
    annual_salary: 62475000, monthly_salary: 5206250,
    phone: '01025542863', email: 'minkyu.park@paulus.pro',
  },
  {
    id: 'emp-5', employee_no: 5, name: '임혁', status: '재직중',
    join_date: '2021-12-01', department: 'Production', team: 'Directing',
    position: 'Director', category: 'Senior',
    level: 'S1', class_level: 'C',
    annual_salary: 46972750, monthly_salary: 3914400,
    phone: '01091249262', email: 'hyuk.lim@paulus.pro',
  },
  {
    id: 'emp-6', employee_no: 6, name: '이정헌', status: '재직중',
    join_date: '2022-01-05', department: 'Production', team: 'NEXT',
    position: '3D Designer', category: 'Senior',
    level: 'S1', class_level: 'A',
    annual_salary: 40000000, monthly_salary: 3333340,
    phone: '01050230483', email: 'junghun.lee@paulus.pro',
  },
  {
    id: 'emp-7', employee_no: 7, name: '홍원준', status: '재직중',
    join_date: '2022-04-01', department: 'Production', team: 'NEXT',
    position: 'Executive Producer', category: 'Leader',
    level: 'L1', class_level: 'C',
    annual_salary: 66010000, monthly_salary: 5500840,
    phone: '01034341916', email: 'wonjun.hong@paulus.pro',
  },
  {
    id: 'emp-8', employee_no: 8, name: '백송희', status: '재직중',
    join_date: '2022-07-11', department: 'Production', team: 'Production',
    position: 'Line Producer', category: 'Senior',
    level: 'S1', class_level: 'C',
    annual_salary: 44950000, monthly_salary: 3745840,
    phone: '01080786808', email: 'songhee.baek@paulus.pro',
  },
  {
    id: 'emp-9', employee_no: 9, name: '정승채', status: '재직중',
    join_date: '2022-09-01', department: 'Management', team: '경영기획실',
    position: 'Managing Director', category: 'Senior',
    level: 'S2', class_level: 'C',
    annual_salary: 54950000, monthly_salary: 4579170,
    phone: '01073213025', email: 'seungchae.jung@paulus.pro',
  },
  {
    id: 'emp-10', employee_no: 10, name: '한상현', status: '재직중',
    join_date: '2024-01-29', department: 'Production', team: 'Post Edit',
    position: 'Editing Director', category: 'Senior',
    level: 'S1', class_level: 'D',
    annual_salary: 47871750, monthly_salary: 3989320,
    phone: '01077941013', email: 'sanghyun.han@paulus.pro',
  },
  {
    id: 'emp-11', employee_no: 11, name: '김현진', status: '재직중',
    join_date: '2024-06-01', department: 'Production', team: 'Directing',
    position: 'Assistant Director', category: 'Junior',
    level: 'P', class_level: 'E',
    annual_salary: 34900000, monthly_salary: 2908340,
    phone: '01053252452', email: 'hyunjin.kim@paulus.pro',
  },
  {
    id: 'emp-12', employee_no: 12, name: '안지민', status: '재직중',
    join_date: '2024-08-01', department: 'Creative Solution', team: 'Team A',
    position: 'Senior Art Director', category: 'Senior',
    level: 'S1', class_level: 'C-',
    annual_salary: 44000000, monthly_salary: 3666670,
    phone: '01055132209', email: 'jimin.ahn@paulus.pro',
  },
  {
    id: 'emp-13', employee_no: 13, name: '티아고 소우자', status: '재직중',
    join_date: '2024-10-07', department: 'Production', team: 'NEXT',
    position: 'Senior 3D Designer', category: 'Mid',
    level: 'S2', class_level: 'D',
    annual_salary: 57420000, monthly_salary: 4785000,
    phone: '01066296632', email: 'tiago.souza@paulus.pro',
  },
  {
    id: 'emp-14', employee_no: 14, name: '표인하', status: '재직중',
    join_date: '2024-11-25', department: 'Management', team: '경영기획실',
    position: 'Finance Manager', category: 'Senior',
    level: 'S1', class_level: 'A',
    annual_salary: 42400000, monthly_salary: 3533340,
    phone: '01038008842', email: 'ooodj@naver.com',
  },
  {
    id: 'emp-15', employee_no: 15, name: '이지수', status: '재직중',
    join_date: '2025-01-02', department: 'Creative Solution', team: 'Team A',
    position: 'Art Director', category: 'Junior',
    level: 'P', class_level: 'D',
    annual_salary: 34094700, monthly_salary: 2841230,
    phone: '01067570491', email: 'jisu.lee@paulus.pro',
  },
  {
    id: 'emp-16', employee_no: 16, name: '이지우', status: '재직중',
    join_date: '2025-02-03', department: 'Production', team: 'Directing',
    position: 'Assistant Director', category: 'Junior',
    level: 'P', class_level: 'C',
    annual_salary: 31997880, monthly_salary: 2666490,
    phone: '01091279626', email: 'jiwoo.lee@paulus.pro',
  },
  {
    id: 'emp-17', employee_no: 17, name: '고민혁', status: '재직중',
    join_date: '2025-03-04', department: 'Management', team: '경영기획실',
    position: 'General Affairs Manager', category: 'Junior',
    level: 'P', class_level: 'E',
    annual_salary: 34000000, monthly_salary: 2833340,
    phone: '01043593087', email: 'rhalsgurdl@naver.com',
  },
  {
    id: 'emp-18', employee_no: 18, name: '이봄이', status: '재직중',
    join_date: '2025-05-19', department: 'Creative Solution', team: 'Team A',
    position: 'Creative Manager', category: 'Senior',
    level: 'S1', class_level: 'B',
    annual_salary: 42700000, monthly_salary: 3558340,
    phone: '01073562905', email: 'bomeelee2@naver.com',
  },
  {
    id: 'emp-19', employee_no: 19, name: '정재영', status: '재직중',
    join_date: '2025-05-26', department: 'Creative Solution', team: 'Team B',
    position: 'Art Director', category: 'Junior',
    level: 'P', class_level: 'A',
    annual_salary: 31997880, monthly_salary: 2666490,
    phone: '01071359633', email: 'minhojenny@naver.com',
  },
  {
    id: 'emp-20', employee_no: 20, name: '권설', status: '재직중',
    join_date: '2025-06-02', department: 'Production', team: 'NEXT',
    position: '3D Designer', category: 'Junior',
    level: 'P1', class_level: 'A',
    annual_salary: 35600000, monthly_salary: 2966670,
    phone: '01040894869', email: 'ksul0116@gmail.com',
  },
  {
    id: 'emp-21', employee_no: 21, name: '정형화', status: '재직중',
    join_date: '2025-10-13', department: 'Production', team: 'Production',
    position: 'Line Producer', category: 'Junior',
    level: 'P1', class_level: 'C',
    annual_salary: 38000000, monthly_salary: 3166670,
    phone: '01077666833', email: 'junghh91@gmail.com',
  },
  {
    id: 'emp-22', employee_no: 22, name: '김기배', status: '재직중',
    join_date: '2025-12-18', department: 'Production', team: 'Post Edit',
    position: '2D Designer', category: 'Senior',
    level: 'S1', class_level: 'D',
    annual_salary: 47800000, monthly_salary: 3983340,
    phone: '01074502857', email: 'wrose1202@gmail.com',
  },
  {
    id: 'emp-23', employee_no: 23, name: '김홍탁', status: '재직중',
    join_date: '2025-01-01', department: 'Creative Solution', team: '',
    position: 'MASTER', category: 'C-lev',
    level: 'D1', class_level: '-',
    annual_salary: 24000000, monthly_salary: 2000000,
    phone: '01072731188', email: 'hongtack.kim@paulus.pro',
  },
  {
    id: 'emp-24', employee_no: 24, name: '김광수', status: '재직중',
    join_date: '2022-09-01', department: 'Renatus', team: '',
    position: 'Master Trainer', category: 'Leader',
    level: 'L2', class_level: '-',
    annual_salary: 50400000, monthly_salary: 4200000,
    phone: '01090722391', email: 'kwangsu.kim@paulus.pro',
  },
];

// ============================================
// 연봉규정표 (ver.2025.01.08)
// ============================================
export const mockSalaryGrades: AdminSalaryGrade[] = [
  // DIRECTOR
  { id: 'sg-d1', category: 'DIRECTOR', level: 'D1', class_level: '-', annual_salary: 80000000, monthly_salary: 6666670, hourly_wage: 27057, base_salary: 5654951, fixed_overtime: 811715, meal_allowance: 200000, probation_salary: 6000000, promotion_condition: '', tenure_requirement: '', experience_requirement: '' },

  // LEADER L2
  { id: 'sg-l2e', category: 'LEADER', level: 'L2', class_level: 'E', annual_salary: 79900000, monthly_salary: 6658340, hourly_wage: 27022, base_salary: 5647664, fixed_overtime: 810669, meal_allowance: 200000, probation_salary: 6012500, promotion_condition: '승직가능', tenure_requirement: '기본 1년 (상시가능)', experience_requirement: '7년 이상 10년 미만' },
  { id: 'sg-l2d', category: 'LEADER', level: 'L2', class_level: 'D', annual_salary: 77425000, monthly_salary: 6452090, hourly_wage: 26159, base_salary: 5467303, fixed_overtime: 784780, meal_allowance: 200000, probation_salary: 5826875, promotion_condition: '', tenure_requirement: '', experience_requirement: '' },
  { id: 'sg-l2c', category: 'LEADER', level: 'L2', class_level: 'C', annual_salary: 74950000, monthly_salary: 6245840, hourly_wage: 25296, base_salary: 5286942, fixed_overtime: 758891, meal_allowance: 200000, probation_salary: 5641250, promotion_condition: '', tenure_requirement: '', experience_requirement: '' },
  { id: 'sg-l2b', category: 'LEADER', level: 'L2', class_level: 'B', annual_salary: 72475000, monthly_salary: 6039590, hourly_wage: 24433, base_salary: 5106581, fixed_overtime: 733002, meal_allowance: 200000, probation_salary: 5455625, promotion_condition: '', tenure_requirement: '', experience_requirement: '' },
  { id: 'sg-l2a', category: 'LEADER', level: 'L2', class_level: 'A', annual_salary: 70000000, monthly_salary: 5833340, hourly_wage: 23570, base_salary: 4926220, fixed_overtime: 707113, meal_allowance: 200000, probation_salary: 5270000, promotion_condition: '', tenure_requirement: '', experience_requirement: '' },

  // LEADER L1
  { id: 'sg-l1e', category: 'LEADER', level: 'L1', class_level: 'E', annual_salary: 69900000, monthly_salary: 5825000, hourly_wage: 23536, base_salary: 4918933, fixed_overtime: 706067, meal_allowance: 200000, probation_salary: 5262500, promotion_condition: '승직가능', tenure_requirement: '1년마다 연봉협상', experience_requirement: '5년 이상 7년 미만' },
  { id: 'sg-l1d', category: 'LEADER', level: 'L1', class_level: 'D', annual_salary: 67425000, monthly_salary: 5618750, hourly_wage: 22673, base_salary: 4738572, fixed_overtime: 680178, meal_allowance: 200000, probation_salary: 5076875, promotion_condition: '', tenure_requirement: '', experience_requirement: '' },
  { id: 'sg-l1c', category: 'LEADER', level: 'L1', class_level: 'C', annual_salary: 64950000, monthly_salary: 5412500, hourly_wage: 21810, base_salary: 4558211, fixed_overtime: 654289, meal_allowance: 200000, probation_salary: 4891250, promotion_condition: '', tenure_requirement: '', experience_requirement: '' },
  { id: 'sg-l1b', category: 'LEADER', level: 'L1', class_level: 'B', annual_salary: 62475000, monthly_salary: 5206250, hourly_wage: 20947, base_salary: 4377850, fixed_overtime: 628400, meal_allowance: 200000, probation_salary: 4705625, promotion_condition: '', tenure_requirement: '', experience_requirement: '' },
  { id: 'sg-l1a', category: 'LEADER', level: 'L1', class_level: 'A', annual_salary: 60000000, monthly_salary: 5000000, hourly_wage: 20084, base_salary: 4197490, fixed_overtime: 602510, meal_allowance: 200000, probation_salary: 4520000, promotion_condition: '', tenure_requirement: '', experience_requirement: '' },

  // SENIOR S2
  { id: 'sg-s2e', category: 'SENIOR', level: 'S2', class_level: 'E', annual_salary: 59900000, monthly_salary: 4991670, hourly_wage: 20049, base_salary: 4190202, fixed_overtime: 601464, meal_allowance: 200000, probation_salary: 4512500, promotion_condition: 'P4-A~C로 가능', tenure_requirement: '1년마다 연봉협상', experience_requirement: '4년 이상 5년 미만' },
  { id: 'sg-s2d', category: 'SENIOR', level: 'S2', class_level: 'D', annual_salary: 57425000, monthly_salary: 4785420, hourly_wage: 19186, base_salary: 4009841, fixed_overtime: 575575, meal_allowance: 200000, probation_salary: 4326875, promotion_condition: '', tenure_requirement: '', experience_requirement: '' },
  { id: 'sg-s2c', category: 'SENIOR', level: 'S2', class_level: 'C', annual_salary: 54950000, monthly_salary: 4579170, hourly_wage: 18323, base_salary: 3829480, fixed_overtime: 549686, meal_allowance: 200000, probation_salary: 4141250, promotion_condition: '', tenure_requirement: '', experience_requirement: '' },
  { id: 'sg-s2b', category: 'SENIOR', level: 'S2', class_level: 'B', annual_salary: 52475000, monthly_salary: 4372920, hourly_wage: 17460, base_salary: 3649120, fixed_overtime: 523797, meal_allowance: 200000, probation_salary: 3955625, promotion_condition: '승직불가', tenure_requirement: '', experience_requirement: '' },
  { id: 'sg-s2a', category: 'SENIOR', level: 'S2', class_level: 'A', annual_salary: 50000000, monthly_salary: 4166670, hourly_wage: 16597, base_salary: 3468759, fixed_overtime: 497908, meal_allowance: 200000, probation_salary: 3770000, promotion_condition: '', tenure_requirement: '3년 이상 4년 미만', experience_requirement: '' },

  // SENIOR S1
  { id: 'sg-s1e', category: 'SENIOR', level: 'S1', class_level: 'E', annual_salary: 49900000, monthly_salary: 4158340, hourly_wage: 16562, base_salary: 3461471, fixed_overtime: 496862, meal_allowance: 200000, probation_salary: 3762500, promotion_condition: '', tenure_requirement: '1년마다 연봉협상', experience_requirement: '' },
  { id: 'sg-s1d', category: 'SENIOR', level: 'S1', class_level: 'D', annual_salary: 47425000, monthly_salary: 3952090, hourly_wage: 15699, base_salary: 3281111, fixed_overtime: 470973, meal_allowance: 200000, probation_salary: 3576875, promotion_condition: 'P3-A~C로 가능', tenure_requirement: '', experience_requirement: '' },
  { id: 'sg-s1c', category: 'SENIOR', level: 'S1', class_level: 'C', annual_salary: 44950000, monthly_salary: 3745840, hourly_wage: 14836, base_salary: 3100750, fixed_overtime: 445084, meal_allowance: 200000, probation_salary: 3391250, promotion_condition: '', tenure_requirement: '1년마다 연봉협상', experience_requirement: '2년 이상 3년 미만' },
  { id: 'sg-s1b', category: 'SENIOR', level: 'S1', class_level: 'B', annual_salary: 42475000, monthly_salary: 3539590, hourly_wage: 13973, base_salary: 2920389, fixed_overtime: 419195, meal_allowance: 200000, probation_salary: 3205625, promotion_condition: '승직불가', tenure_requirement: '', experience_requirement: '' },
  { id: 'sg-s1a', category: 'SENIOR', level: 'S1', class_level: 'A', annual_salary: 40000000, monthly_salary: 3333340, hourly_wage: 13110, base_salary: 2740028, fixed_overtime: 393305, meal_allowance: 200000, probation_salary: 3020000, promotion_condition: '', tenure_requirement: '', experience_requirement: '' },

  // JUNIOR P1
  { id: 'sg-p1e', category: 'JUNIOR', level: 'P1', class_level: 'E', annual_salary: 39900000, monthly_salary: 3325000, hourly_wage: 13075, base_salary: 2732741, fixed_overtime: 392259, meal_allowance: 200000, probation_salary: 3012500, promotion_condition: 'P2-A~C로 가능', tenure_requirement: '상시적으로 연봉통보 (또는 1년주기)', experience_requirement: '1년 이상 2년 미만' },
  { id: 'sg-p1d', category: 'JUNIOR', level: 'P1', class_level: 'D', annual_salary: 38675000, monthly_salary: 3222920, hourly_wage: 12648, base_salary: 2643471, fixed_overtime: 379446, meal_allowance: 200000, probation_salary: 2920625, promotion_condition: '', tenure_requirement: '', experience_requirement: '' },
  { id: 'sg-p1c', category: 'JUNIOR', level: 'P1', class_level: 'C', annual_salary: 37450000, monthly_salary: 3120840, hourly_wage: 12221, base_salary: 2554202, fixed_overtime: 366632, meal_allowance: 200000, probation_salary: 2828750, promotion_condition: '', tenure_requirement: '', experience_requirement: '' },
  { id: 'sg-p1b', category: 'JUNIOR', level: 'P1', class_level: 'B', annual_salary: 36225000, monthly_salary: 3018750, hourly_wage: 11794, base_salary: 2464932, fixed_overtime: 353818, meal_allowance: 200000, probation_salary: 2736875, promotion_condition: '승직불가', tenure_requirement: '', experience_requirement: '' },
  { id: 'sg-p1a', category: 'JUNIOR', level: 'P1', class_level: 'A', annual_salary: 35000000, monthly_salary: 2916670, hourly_wage: 11367, base_salary: 2375662, fixed_overtime: 341004, meal_allowance: 200000, probation_salary: 2645000, promotion_condition: '', tenure_requirement: '', experience_requirement: '' },

  // JUNIOR P
  { id: 'sg-pe', category: 'JUNIOR', level: 'P', class_level: 'E', annual_salary: 34900000, monthly_salary: 2908340, hourly_wage: 11332, base_salary: 2368375, fixed_overtime: 339958, meal_allowance: 200000, probation_salary: 2637500, promotion_condition: 'P1-A~C로 가능', tenure_requirement: '상시적으로 연봉통보 (또는 1년주기)', experience_requirement: '1년 미만' },
  { id: 'sg-pd', category: 'JUNIOR', level: 'P', class_level: 'D', annual_salary: 34104000, monthly_salary: 2842000, hourly_wage: 11054, base_salary: 2310368, fixed_overtime: 331632, meal_allowance: 200000, probation_salary: 2577800, promotion_condition: '', tenure_requirement: '', experience_requirement: '' },
  { id: 'sg-pc', category: 'JUNIOR', level: 'P', class_level: 'C', annual_salary: 33308000, monthly_salary: 2775670, hourly_wage: 10777, base_salary: 2252361, fixed_overtime: 323305, meal_allowance: 200000, probation_salary: 2518100, promotion_condition: '', tenure_requirement: '', experience_requirement: '' },
  { id: 'sg-pb', category: 'JUNIOR', level: 'P', class_level: 'B', annual_salary: 32512000, monthly_salary: 2709340, hourly_wage: 10499, base_salary: 2194354, fixed_overtime: 314979, meal_allowance: 200000, probation_salary: 2458400, promotion_condition: '승직불가', tenure_requirement: '', experience_requirement: '' },
  { id: 'sg-pa', category: 'JUNIOR', level: 'P', class_level: 'A', annual_salary: 31716000, monthly_salary: 2643000, hourly_wage: 10222, base_salary: 2136347, fixed_overtime: 306653, meal_allowance: 200000, probation_salary: 2398700, promotion_condition: '', tenure_requirement: '', experience_requirement: '' },

  // INTERN
  { id: 'sg-intern', category: 'INTERN', level: 'Intern', class_level: '-', annual_salary: 22080000, monthly_salary: 1840000, hourly_wage: 10000, base_salary: 1680000, fixed_overtime: 0, meal_allowance: 160000, probation_salary: 0, promotion_condition: 'P-A,B로 가능', tenure_requirement: '3개월', experience_requirement: '' },
];
