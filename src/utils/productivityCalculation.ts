/**
 * Productivity 기여도 산정 유틸리티
 *
 * 공식:
 * 1. 내수율(프로젝트 수익) = 촬영 진행비를 뺀 실제 수익
 * 2. 배분 가능 금액 = 내수율 - 경상비(25%) - 순이익(15%) = 내수율 × 60%
 * 3. 각 유저의 기여도 = 해당 유저 연봉 / 참여 유저 연봉 합계
 * 4. 유저별 기여금액 = 배분 가능 금액 × 기여도
 */

export interface ProjectProductivity {
  projectId: string;
  projectTitle: string;
  client: string;
  totalRevenue: number; // 총 수주액
  productionCost: number; // 촬영 진행비
  netRevenue: number; // 내수율 = totalRevenue - productionCost
  operatingExpenseRate: number; // 경상비 비율 (기본 0.25)
  netProfitRate: number; // 순이익 비율 (기본 0.15)
  distributableAmount: number; // 배분 가능 금액
}

export interface UserContribution {
  userId: string;
  userName: string;
  annualSalary: number;
  contributionRate: number; // 0~1 (percentage)
  contributionAmount: number; // 배분 금액
}

export interface ProjectProductivityResult {
  project: ProjectProductivity;
  contributions: UserContribution[];
}

/**
 * 프로젝트 기여도 산정
 */
export function calculateProjectProductivity(
  projectTitle: string,
  projectId: string,
  client: string,
  totalRevenue: number,
  productionCost: number,
  participants: { userId: string; userName: string; annualSalary: number }[],
  operatingExpenseRate = 0.25,
  netProfitRate = 0.15,
): ProjectProductivityResult {
  const netRevenue = totalRevenue - productionCost;
  const distributableRate = 1 - operatingExpenseRate - netProfitRate; // 60%
  const distributableAmount = netRevenue * distributableRate;

  const totalSalary = participants.reduce((sum, p) => sum + p.annualSalary, 0);

  const contributions: UserContribution[] = participants.map(p => {
    const rate = totalSalary > 0 ? p.annualSalary / totalSalary : 0;
    return {
      userId: p.userId,
      userName: p.userName,
      annualSalary: p.annualSalary,
      contributionRate: rate,
      contributionAmount: Math.round(distributableAmount * rate),
    };
  });

  return {
    project: {
      projectId,
      projectTitle,
      client,
      totalRevenue,
      productionCost,
      netRevenue,
      operatingExpenseRate,
      netProfitRate,
      distributableAmount: Math.round(distributableAmount),
    },
    contributions,
  };
}

/**
 * 금액 포맷 (억/만원 단위)
 */
export function formatAmount(amount: number): string {
  if (Math.abs(amount) >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}억`;
  }
  if (Math.abs(amount) >= 10000) {
    return `${Math.round(amount / 10000).toLocaleString()}만원`;
  }
  return `${amount.toLocaleString()}원`;
}
