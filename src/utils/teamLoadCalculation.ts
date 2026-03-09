/**
 * Team Load 계산 유틸리티
 *
 * 수식: 가중 합산 방식 (2026-03-09 업데이트)
 * - To-do 할당: 30% (주간 부여받은 업무량)
 * - 캘린더 이벤트: 30% (등록된 스케줄 수)
 * - 보드 업무(Gantt): 40% (Projectboard에 입력된 참여 업무)
 *
 * loadScore = (todoRatio * 0.30) + (calendarRatio * 0.30) + (boardTaskRatio * 0.40)
 */

export interface TeamLoadInput {
  userId: string;
  todosAssigned: number;
  calendarEvents: number;
  boardTasks: number;
}

export interface TeamLoadResult {
  userId: string;
  todosAssigned: number;
  calendarEvents: number;
  boardTasks: number;
  loadScore: number;
}

export const WEIGHTS = {
  todo: 0.30,
  calendar: 0.30,
  board: 0.40,
} as const;

export function calculateTeamLoad(inputs: TeamLoadInput[]): TeamLoadResult[] {
  const totalTodo = inputs.reduce((s, i) => s + i.todosAssigned, 0) || 1;
  const totalCalendar = inputs.reduce((s, i) => s + i.calendarEvents, 0) || 1;
  const totalBoard = inputs.reduce((s, i) => s + i.boardTasks, 0) || 1;

  return inputs.map(input => {
    const todoRatio = input.todosAssigned / totalTodo;
    const calendarRatio = input.calendarEvents / totalCalendar;
    const boardRatio = input.boardTasks / totalBoard;

    const loadScore =
      (todoRatio * WEIGHTS.todo) +
      (calendarRatio * WEIGHTS.calendar) +
      (boardRatio * WEIGHTS.board);

    return {
      userId: input.userId,
      todosAssigned: input.todosAssigned,
      calendarEvents: input.calendarEvents,
      boardTasks: input.boardTasks,
      loadScore: Math.round(loadScore * 10000) / 100,
    };
  });
}
