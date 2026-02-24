/**
 * Important Notes Service — Supabase CRUD for project-scoped important notes.
 * Notes are visible to all project team members.
 */

import { supabase, isSupabaseConfigured, handleSupabaseError } from '@/lib/supabase';
import { withSupabaseRetry } from '@/lib/retry';
import type { ImportantNote } from '@/types/core';

interface NoteRow {
  id: string;
  project_id: string;
  content: string;
  source_message_id: string | null;
  created_by: string;
  created_at: string;
}

const transformNote = (row: NoteRow): ImportantNote => ({
  id: row.id,
  projectId: row.project_id,
  content: row.content,
  sourceMessageId: row.source_message_id || undefined,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

export async function getNotesByProject(projectId: string): Promise<ImportantNote[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await withSupabaseRetry(
    () => supabase
      .from('important_notes')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
    { label: 'getNotesByProject' },
  );

  if (error) {
    console.error('Failed to load important notes:', error);
    return [];
  }

  return (data || []).map(transformNote);
}

export async function createNote(note: Omit<ImportantNote, 'id' | 'createdAt'>): Promise<ImportantNote | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('important_notes')
    .insert({
      project_id: note.projectId,
      content: note.content,
      source_message_id: note.sourceMessageId || null,
      created_by: note.createdBy,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create important note:', handleSupabaseError(error));
    return null;
  }

  return transformNote(data);
}

export async function deleteNote(noteId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('important_notes')
    .delete()
    .eq('id', noteId);

  if (error) {
    console.error('Failed to delete important note:', handleSupabaseError(error));
    return false;
  }

  return true;
}

export async function getAllNotesForProjects(projectIds: string[]): Promise<ImportantNote[]> {
  if (!isSupabaseConfigured() || projectIds.length === 0) return [];

  const { data, error } = await withSupabaseRetry(
    () => supabase
      .from('important_notes')
      .select('*')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false }),
    { label: 'getAllNotesForProjects' },
  );

  if (error) {
    console.error('Failed to load all important notes:', error);
    return [];
  }

  return (data || []).map(transformNote);
}
