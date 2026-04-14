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

  // IMPORTANT: important_notes table has no `updated_at` column (see mig 066).
  // Setting it here would fail with a PGRST schema error and the update would
  // be rejected silently — leading to the "edits never persist" symptom.
  const payload: Record<string, unknown> = {};
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

/**
 * Fetch every important note the current user can see.
 *
 * Previously this function filtered by `project_id IN (<client-side projects>)`,
 * which meant the client's stale/partial `projects` state would silently drop
 * notes from projects the user was legitimately a member of. After migration
 * 102 tightened the SELECT RLS to project members only, we can safely let the
 * database decide visibility and drop the client filter entirely.
 */
export async function getAllAccessibleNotes(): Promise<ImportantNote[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await withSupabaseRetry(
    () => supabase
      .from('important_notes')
      .select('*')
      .order('created_at', { ascending: false }),
    { label: 'getAllAccessibleNotes' },
  );

  if (error) {
    console.error('Failed to load important notes:', error);
    return [];
  }

  return (data || []).map(transformNote);
}
