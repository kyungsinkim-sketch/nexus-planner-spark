/**
 * Team Load Snapshot 계산 유틸리티
 *
 * 수식: 가중 합산 방식
 * - 채팅 메시지: 25% (소통 빈도)
 * - 파일 업로드: 25% (실제 산출물)
 * - To-do 완료: 30% (작업 수행량)
 * - 캘린더 이벤트: 20% (일정/미팅 참여도)
 *
 * 각 항목은 전체 프로젝트 내 해당 유저의 비율로 계산
 * loadScore = (chatRatio * 0.25) + (fileRatio * 0.25) + (todoRatio * 0.30) + (calendarRatio * 0.20)
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
  file: 0.25,
  todo: 0.30,
  calendar: 0.20,
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
