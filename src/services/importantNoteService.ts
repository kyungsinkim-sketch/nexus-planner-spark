/**
 * Important Notes Service — Supabase CRUD for project-scoped important notes.
 * Notes are visible to all project team members.
 */

import { supabase, isSupabaseConfigured, handleSupabaseError } from '@/lib/supabase';
import { withSupabaseRetry } from '@/lib/retry';
import type { ImportantNote } from '@/types/core';

interface NoteRow {
  id: string;
  project_id: string | null;
  title: string | null;
  content: string;
  source_message_id: string | null;
  created_by: string;
  created_at: string;
}

const transformNote = (row: NoteRow): ImportantNote => ({
  id: row.id,
  projectId: row.project_id || '',
  title: row.title || undefined,
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
      title: note.title || null,
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

export async function updateNote(noteId: string, updates: { title?: string; content?: string }): Promise<ImportantNote | null> {
  if (!isSupabaseConfigured()) return null;

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.content !== undefined) payload.content = updates.content;

  const { data, error } = await supabase
    .from('important_notes')
    .update(payload)
    .eq('id', noteId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update important note:', handleSupabaseError(error));
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
  if (!isSupabaseConfigured()) return [];

  // Fetch project-scoped notes + notes with NULL project_id (created from DM/Brain AI)
  const { data, error } = await withSupabaseRetry(
    () => supabase
      .from('important_notes')
      .select('*')
      .or(`project_id.in.(${projectIds.join(',')}),project_id.is.null`)
      .order('created_at', { ascending: false }),
    { label: 'getAllNotesForProjects' },
  );

  if (error) {
    console.error('Failed to load all important notes:', error);
    return [];
  }

  return (data || []).map(transformNote);
}
