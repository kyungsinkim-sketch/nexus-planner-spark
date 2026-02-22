/**
 * Board Service — CRUD for board groups and board tasks (Project Board Widget).
 * Supports Supabase backend with mock data fallback.
 */

import { supabase, isSupabaseConfigured, handleSupabaseError } from '@/lib/supabase';
import type { BoardGroup, BoardTask, BoardTaskStatus } from '@/types/core';
import type { Database } from '@/types/database';

type GroupRow = Database['public']['Tables']['board_groups']['Row'];
type TaskRow = Database['public']['Tables']['board_tasks']['Row'];

// ── Transform helpers ──────────────────────────────────────

const transformGroup = (row: GroupRow): BoardGroup => ({
  id: row.id,
  projectId: row.project_id,
  title: row.title,
  color: row.color,
  orderNo: row.order_no,
  createdAt: row.created_at,
});

const transformTask = (row: TaskRow): BoardTask => ({
  id: row.id,
  boardGroupId: row.board_group_id,
  projectId: row.project_id,
  title: row.title,
  status: row.status as BoardTaskStatus,
  ownerId: row.owner_id,
  reviewerIds: row.reviewer_ids || undefined,
  startDate: row.start_date || undefined,
  endDate: row.end_date || undefined,
  dueDate: row.due_date || undefined,
  progress: row.progress,
  orderNo: row.order_no,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// ── Board Groups ───────────────────────────────────────────

export async function getBoardGroups(projectId: string): Promise<BoardGroup[]> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('board_groups')
    .select('*')
    .eq('project_id', projectId)
    .order('order_no', { ascending: true });

  if (error) throw new Error(handleSupabaseError(error));
  return (data || []).map(transformGroup);
}

export async function createBoardGroup(
  projectId: string,
  title: string,
  color: string = '#0073EA',
  orderNo: number = 0,
): Promise<BoardGroup> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('board_groups')
    .insert({ project_id: projectId, title, color, order_no: orderNo })
    .select()
    .single();

  if (error) throw new Error(handleSupabaseError(error));
  return transformGroup(data);
}

export async function updateBoardGroup(
  groupId: string,
  updates: { title?: string; color?: string; orderNo?: number },
): Promise<BoardGroup> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

  const dbUpdates: Record<string, unknown> = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.color !== undefined) dbUpdates.color = updates.color;
  if (updates.orderNo !== undefined) dbUpdates.order_no = updates.orderNo;

  const { data, error } = await supabase
    .from('board_groups')
    .update(dbUpdates)
    .eq('id', groupId)
    .select()
    .single();

  if (error) throw new Error(handleSupabaseError(error));
  return transformGroup(data);
}

export async function deleteBoardGroup(groupId: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

  const { error } = await supabase
    .from('board_groups')
    .delete()
    .eq('id', groupId);

  if (error) throw new Error(handleSupabaseError(error));
}

// ── Board Tasks ────────────────────────────────────────────

export async function getBoardTasks(projectId: string): Promise<BoardTask[]> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('board_tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('order_no', { ascending: true });

  if (error) throw new Error(handleSupabaseError(error));
  return (data || []).map(transformTask);
}

export async function createBoardTask(task: {
  boardGroupId: string;
  projectId: string;
  title: string;
  ownerId: string;
  status?: BoardTaskStatus;
  reviewerIds?: string[];
  startDate?: string;
  endDate?: string;
  dueDate?: string;
  progress?: number;
  orderNo?: number;
}): Promise<BoardTask> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('board_tasks')
    .insert({
      board_group_id: task.boardGroupId,
      project_id: task.projectId,
      title: task.title,
      owner_id: task.ownerId,
      status: task.status || 'backlog',
      reviewer_ids: task.reviewerIds || [],
      start_date: task.startDate || null,
      end_date: task.endDate || null,
      due_date: task.dueDate || null,
      progress: task.progress || 0,
      order_no: task.orderNo || 0,
    })
    .select()
    .single();

  if (error) throw new Error(handleSupabaseError(error));
  return transformTask(data);
}

export async function updateBoardTask(
  taskId: string,
  updates: Partial<{
    title: string;
    status: BoardTaskStatus;
    ownerId: string;
    reviewerIds: string[];
    startDate: string | null;
    endDate: string | null;
    dueDate: string | null;
    progress: number;
    boardGroupId: string;
    orderNo: number;
  }>,
): Promise<BoardTask> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

  const dbUpdates: Record<string, unknown> = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.ownerId !== undefined) dbUpdates.owner_id = updates.ownerId;
  if (updates.reviewerIds !== undefined) dbUpdates.reviewer_ids = updates.reviewerIds;
  if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
  if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
  if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
  if (updates.progress !== undefined) dbUpdates.progress = updates.progress;
  if (updates.boardGroupId !== undefined) dbUpdates.board_group_id = updates.boardGroupId;
  if (updates.orderNo !== undefined) dbUpdates.order_no = updates.orderNo;

  const { data, error } = await supabase
    .from('board_tasks')
    .update(dbUpdates)
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw new Error(handleSupabaseError(error));
  return transformTask(data);
}

export async function deleteBoardTask(taskId: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

  const { error } = await supabase
    .from('board_tasks')
    .delete()
    .eq('id', taskId);

  if (error) throw new Error(handleSupabaseError(error));
}
