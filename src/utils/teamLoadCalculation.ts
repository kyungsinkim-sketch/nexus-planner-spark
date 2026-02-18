/**
 * Team Load Snapshot 계산 유틸리티
 *
 * 수식: 가중 합산 방식
 * - 채팅 메시지: 25% (소통 빈도)
 * - 파일 업로드: 20% (실제 산출물)
 * - To-do 완료: 40% (작업 수행량)
 * - 캘린더 이벤트: 15% (일정/미팅 참여도)
 *
 * 모든 active 프로젝트를 통합적으로 계산
 * loadScore = (chatRatio * 0.25) + (fileRatio * 0.20) + (todoRatio * 0.40) + (calendarRatio * 0.15)
 */

import type { TeamLoadSnapshot } from '@/types/core';

interface TeamLoadInput {
  userId: string;
  chatMessages: number;
  fileUploads: number;
  todosCompleted: number;
  calendarEvents: number;
}

const WEIGHTS = {
  chat: 0.25,
  file: 0.20,
  todo: 0.40,
  calendar: 0.15,
};

export function calculateTeamLoad(inputs: TeamLoadInput[]): TeamLoadSnapshot[] {
  const totalChat = inputs.reduce((s, i) => s + i.chatMessages, 0) || 1;
  const totalFile = inputs.reduce((s, i) => s + i.fileUploads, 0) || 1;
  const totalTodo = inputs.reduce((s, i) => s + i.todosCompleted, 0) || 1;
  const totalCalendar = inputs.reduce((s, i) => s + i.calendarEvents, 0) || 1;

  return inputs.map(input => {
    const chatRatio = input.chatMessages / totalChat;
    const fileRatio = input.fileUploads / totalFile;
    const todoRatio = input.todosCompleted / totalTodo;
    const calendarRatio = input.calendarEvents / totalCalendar;

    const loadScore = (chatRatio * WEIGHTS.chat) + (fileRatio * WEIGHTS.file) + (todoRatio * WEIGHTS.todo) + (calendarRatio * WEIGHTS.calendar);

    return {
      userId: input.userId,
      chatMessages: input.chatMessages,
      fileUploads: input.fileUploads,
      todosCompleted: input.todosCompleted,
      calendarEvents: input.calendarEvents,
      loadScore: Math.round(loadScore * 10000) / 100, // percentage with 2 decimals
    };
  });
}

export { WEIGHTS };
