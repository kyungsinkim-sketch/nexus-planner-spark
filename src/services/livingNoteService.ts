import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface LivingNote {
  id: string;
  projectId: string | null;
  ownerId: string;
  title: string;
  currentState: string | null;
  status: 'active' | 'resolved' | 'archived';
  pinOrder: number;
  relatedNoteIds: string[];
  createdAt: string;
  updatedAt: string;
  entries?: LivingNoteEntry[];
  entryCount?: number;
  lastEntryAt?: string;
}

export interface LivingNoteEntry {
  id: string;
  livingNoteId: string;
  entryType: 'thesis' | 'antithesis' | 'synthesis' | 'reference';
  content: string;
  sourceType: 'chat' | 'email' | 'call' | 'slack' | 'notion' | 'manual' | null;
  sourceMessageId: string | null;
  sourceLabel: string | null;
  createdBy: string | null;
  createdAt: string;
}

function transformNote(row: Record<string, unknown>): LivingNote {
  return {
    id: row.id as string,
    projectId: row.project_id as string | null,
    ownerId: row.owner_id as string,
    title: row.title as string,
    currentState: row.current_state as string | null,
    status: (row.status as string || 'active') as LivingNote['status'],
    pinOrder: (row.pin_order as number) || 0,
    relatedNoteIds: (row.related_note_ids as string[]) || [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function transformEntry(row: Record<string, unknown>): LivingNoteEntry {
  return {
    id: row.id as string,
    livingNoteId: row.living_note_id as string,
    entryType: row.entry_type as LivingNoteEntry['entryType'],
    content: row.content as string,
    sourceType: row.source_type as LivingNoteEntry['sourceType'],
    sourceMessageId: row.source_message_id as string | null,
    sourceLabel: row.source_label as string | null,
    createdBy: row.created_by as string | null,
    createdAt: row.created_at as string,
  };
}

// ─── Notes CRUD ───

export async function getLivingNotes(projectId?: string): Promise<LivingNote[]> {
  if (!isSupabaseConfigured()) return [];

  let query = supabase
    .from('living_notes')
    .select('*, living_note_entries(count)')
    .order('pin_order', { ascending: false })
    .order('updated_at', { ascending: false });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) { console.error('Failed to load living notes:', error); return []; }

  return (data || []).map((row: Record<string, unknown>) => {
    const note = transformNote(row);
    const entries = row.living_note_entries as Array<{ count: number }> | undefined;
    note.entryCount = entries?.[0]?.count || 0;
    return note;
  });
}

export async function getLivingNoteWithEntries(noteId: string): Promise<LivingNote | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('living_notes')
    .select('*')
    .eq('id', noteId)
    .single();

  if (error || !data) return null;

  const note = transformNote(data);

  const { data: entries } = await supabase
    .from('living_note_entries')
    .select('*')
    .eq('living_note_id', noteId)
    .order('created_at', { ascending: false });

  note.entries = (entries || []).map(transformEntry);
  return note;
}

export async function createLivingNote(params: {
  projectId?: string;
  ownerId: string;
  title: string;
  currentState?: string;
}): Promise<LivingNote | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('living_notes')
    .insert({
      project_id: params.projectId || null,
      owner_id: params.ownerId,
      title: params.title,
      current_state: params.currentState || null,
    })
    .select()
    .single();

  if (error) { console.error('Failed to create living note:', error); return null; }
  return transformNote(data);
}

export async function updateLivingNote(noteId: string, updates: {
  title?: string;
  currentState?: string;
  status?: LivingNote['status'];
  pinOrder?: number;
  relatedNoteIds?: string[];
}): Promise<LivingNote | null> {
  if (!isSupabaseConfigured()) return null;

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.currentState !== undefined) payload.current_state = updates.currentState;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.pinOrder !== undefined) payload.pin_order = updates.pinOrder;
  if (updates.relatedNoteIds !== undefined) payload.related_note_ids = updates.relatedNoteIds;

  const { data, error } = await supabase
    .from('living_notes')
    .update(payload)
    .eq('id', noteId)
    .select()
    .single();

  if (error) { console.error('Failed to update living note:', error); return null; }
  return transformNote(data);
}

export async function deleteLivingNote(noteId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { error } = await supabase.from('living_notes').delete().eq('id', noteId);
  if (error) { console.error('Failed to delete living note:', error); return false; }
  return true;
}

// ─── Entries CRUD ───

export async function addEntry(params: {
  livingNoteId: string;
  entryType: LivingNoteEntry['entryType'];
  content: string;
  sourceType?: LivingNoteEntry['sourceType'];
  sourceMessageId?: string;
  sourceLabel?: string;
  createdBy?: string;
  newCurrentState?: string;
}): Promise<LivingNoteEntry | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('living_note_entries')
    .insert({
      living_note_id: params.livingNoteId,
      entry_type: params.entryType,
      content: params.content,
      source_type: params.sourceType || null,
      source_message_id: params.sourceMessageId || null,
      source_label: params.sourceLabel || null,
      created_by: params.createdBy || null,
    })
    .select()
    .single();

  if (error) { console.error('Failed to add entry:', error); return null; }

  // Update the note's current_state and updated_at
  if (params.newCurrentState) {
    await updateLivingNote(params.livingNoteId, { currentState: params.newCurrentState });
  } else {
    await supabase
      .from('living_notes')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', params.livingNoteId);
  }

  return transformEntry(data);
}

export async function deleteEntry(entryId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { error } = await supabase.from('living_note_entries').delete().eq('id', entryId);
  if (error) { console.error('Failed to delete entry:', error); return false; }
  return true;
}

// ─── Search / Match ───

export async function findRelatedNotes(projectId: string, keywords: string[]): Promise<LivingNote[]> {
  if (!isSupabaseConfigured() || !keywords.length) return [];

  // Simple keyword match on title and current_state
  const conditions = keywords.map(k => `title.ilike.%${k}%,current_state.ilike.%${k}%`).join(',');

  const { data, error } = await supabase
    .from('living_notes')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'active')
    .or(conditions);

  if (error) { console.error('Failed to search living notes:', error); return []; }
  return (data || []).map(transformNote);
}
