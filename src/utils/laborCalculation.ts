/**
 * 근무시간 산정 유틸리티
 * 파울러스 선택근로제(2주 단위) 기준
 *
 * 1. 연장근로: 2주 총 근무시간 80시간 초과분 → 시급 × 1.5
 * 2. 야간근로: 22:00~06:00 → 시급 × 0.5 추가
 *    (연장+야간 중첩 시 1.5 + 0.5 = 2.0배)
 * 3. 주휴일(일요일)/공휴일 근무:
 *    - 대체휴무 제공 시: 가산 미적용 (4h→반차, 8h→1일)
 *    - 대체휴무 미제공 시: 시급 × 1.5
 * 4. 휴게시간/PT시간은 업무시간 제외
 */

export interface DailyWorkRecord {
  date: string; // YYYY-MM-DD
  checkIn: string; // ISO datetime
  checkOut: string; // ISO datetime
  breakMinutes: number; // 휴게시간(분)
  ptMinutes: number; // PT시간(분)
  isHoliday: boolean; // 주휴일(일요일) 또는 공휴일 여부
  substituteLeaveGranted: boolean; // 대체휴무 제공 여부
}

export interface BiweeklyCalculation {
  periodStart: string;
  periodEnd: string;
  totalWorkMinutes: number; // 총 근무시간(분)
  regularMinutes: number; // 기본근로(분) - 80시간까지
  overtimeMinutes: number; // 연장근로(분) - 80시간 초과분
  nightMinutes: number; // 야간근로(분) - 22:00~06:00
  nightOvertimeMinutes: number; // 연장+야간 중첩(분)
  holidayMinutes: number; // 주휴일/공휴일 근무(분) - 대체휴무 미제공분
  holidaySubstitutedMinutes: number; // 대체휴무 적용 근무(분)
  substituteHalfDays: number; // 대체 반차 횟수
  substituteFullDays: number; // 대체 휴무일 횟수
}

export interface PayrollCalculation extends BiweeklyCalculation {
  hourlyWage: number;
  regularPay: number; // 기본급
  overtimePay: number; // 연장근로 수당 (시급 × 1.5)
  nightPay: number; // 야간근로 수당 (시급 × 0.5)
  nightOvertimePay: number; // 연장+야간 중첩 수당 (시급 × 2.0)
  holidayPay: number; // 주휴일/공휴일 수당 (시급 × 1.5)
  totalAdditionalPay: number; // 총 추가 수당
}

const BIWEEKLY_STANDARD_MINUTES = 80 * 60; // 80시간 = 4800분
const NIGHT_START_HOUR = 22;
const NIGHT_END_HOUR = 6;

/**
 * 특정 근무 기록에서 야간근로 시간(분) 계산
 * 22:00 ~ 06:00 사이 근무시간
 */
export function calculateNightMinutes(checkIn: Date, checkOut: Date): number {
  let nightMinutes = 0;

  // Iterate minute by minute (simplified approach for correctness)
  const start = new Date(checkIn);
  const end = new Date(checkOut);

  // Use 15-minute intervals for performance
  const current = new Date(start);
  while (current < end) {
    const hour = current.getHours();
    if (hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR) {
      nightMinutes += 15;
    }
    current.setMinutes(current.getMinutes() + 15);
  }

  return nightMinutes;
}

/**
 * 일일 실근무시간 계산 (분)
 * 총 근무시간 - 휴게시간 - PT시간
 */
export function calculateDailyWorkMinutes(record: DailyWorkRecord): number {
  const checkIn = new Date(record.checkIn);
  const checkOut = new Date(record.checkOut);
  const totalMinutes = Math.max(0, (checkOut.getTime() - checkIn.getTime()) / (1000 * 60));
  return Math.max(0, totalMinutes - record.breakMinutes - record.ptMinutes);
}

/**
 * 2주 단위 근무시간 산정
 */
export function calculateBiweekly(
  records: DailyWorkRecord[],
  periodStart: string,
  periodEnd: string
): BiweeklyCalculation {
  let totalWorkMinutes = 0;
  let nightMinutes = 0;
  let holidayMinutes = 0;
  let holidaySubstitutedMinutes = 0;
  let substituteHalfDays = 0;
  let substituteFullDays = 0;

  // Calculate daily totals
  for (const record of records) {
    const dayWorkMinutes = calculateDailyWorkMinutes(record);
    const dayNightMinutes = calculateNightMinutes(new Date(record.checkIn), new Date(record.checkOut));

    totalWorkMinutes += dayWorkMinutes;

    // Subtract break/PT from night minutes proportionally
    const totalRawMinutes = (new Date(record.checkOut).getTime() - new Date(record.checkIn).getTime()) / (1000 * 60);
    const workRatio = totalRawMinutes > 0 ? dayWorkMinutes / totalRawMinutes : 0;
    nightMinutes += Math.round(dayNightMinutes * workRatio);

    // Holiday processing
    if (record.isHoliday) {
      if (record.substituteLeaveGranted) {
        holidaySubstitutedMinutes += dayWorkMinutes;
        if (dayWorkMinutes >= 8 * 60) {
          substituteFullDays += 1;
        } else if (dayWorkMinutes >= 4 * 60) {
          substituteHalfDays += 1;
        }
      } else {
        holidayMinutes += dayWorkMinutes;
      }
    }
  }

  // Calculate overtime (80시간 초과분)
  const overtimeMinutes = Math.max(0, totalWorkMinutes - BIWEEKLY_STANDARD_MINUTES);
  const regularMinutes = totalWorkMinutes - overtimeMinutes;

  // Split night minutes into regular-night and overtime-night
  // Night minutes that occur during overtime period
  const nightOvertimeMinutes = overtimeMinutes > 0
    ? Math.min(nightMinutes, overtimeMinutes)
    : 0;
  const pureNightMinutes = nightMinutes - nightOvertimeMinutes;

  return {
    periodStart,
    periodEnd,
    totalWorkMinutes,
    regularMinutes,
    overtimeMinutes,
    nightMinutes: pureNightMinutes,
    nightOvertimeMinutes,
    holidayMinutes,
    holidaySubstitutedMinutes,
    substituteHalfDays,
    substituteFullDays,
  };
}

/**
 * 급여 산정
 */
export function calculatePayroll(
  biweekly: BiweeklyCalculation,
  hourlyWage: number
): PayrollCalculation {
  const minuteWage = hourlyWage / 60;

  // 기본급 (정규 근무시간)
  const regularPay = biweekly.regularMinutes * minuteWage;

  // 연장근로: 시급 × 1.5 (야간 중첩분은 별도 계산하므로 제외)
  const pureOvertimeMinutes = biweekly.overtimeMinutes - biweekly.nightOvertimeMinutes;
  const overtimePay = pureOvertimeMinutes * minuteWage * 1.5;

  // 야간근로: 시급 × 0.5 추가 (연장 미중첩분)
  const nightPay = biweekly.nightMinutes * minuteWage * 0.5;

  // 연장+야간 중첩: 시급 × 2.0 (1.5 + 0.5)
  const nightOvertimePay = biweekly.nightOvertimeMinutes * minuteWage * 2.0;

  // 주휴일/공휴일 (대체휴무 미제공): 시급 × 1.5
  const holidayPay = biweekly.holidayMinutes * minuteWage * 1.5;

  const totalAdditionalPay = overtimePay + nightPay + nightOvertimePay + holidayPay;

  return {
    ...biweekly,
    hourlyWage,
    regularPay: Math.round(regularPay),
    overtimePay: Math.round(overtimePay),
    nightPay: Math.round(nightPay),
    nightOvertimePay: Math.round(nightOvertimePay),
    holidayPay: Math.round(holidayPay),
    totalAdditionalPay: Math.round(totalAdditionalPay),
  };
}

/**
 * 분 → 시간:분 포맷
 */
export function formatMinutesToHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * 금액 포맷 (원)
 */
export function formatKRW(amount: number): string {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(amount);
}
