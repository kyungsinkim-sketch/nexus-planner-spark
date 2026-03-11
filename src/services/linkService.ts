/**
 * linkService.ts — CRUD for project_links table
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface ProjectLink {
  id: string;
  projectId: string;
  url: string;
  name: string | null;
  memo: string | null;
  sharedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProjectLinkRow {
  id: string;
  project_id: string;
  url: string;
  name: string | null;
  memo: string | null;
  shared_by: string | null;
  created_at: string;
  updated_at: string;
}

const transform = (row: ProjectLinkRow): ProjectLink => ({
  id: row.id,
  projectId: row.project_id,
  url: row.url,
  name: row.name,
  memo: row.memo,
  sharedBy: row.shared_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function getProjectLinks(projectId: string): Promise<ProjectLink[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('project_links')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as ProjectLinkRow[]).map(transform);
}

export async function createProjectLink(link: {
  projectId: string;
  url: string;
  name?: string;
  memo?: string;
  sharedBy?: string;
}): Promise<ProjectLink> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('project_links')
    .insert({
      project_id: link.projectId,
      url: link.url,
      name: link.name || null,
      memo: link.memo || null,
      shared_by: link.sharedBy || null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return transform(data as ProjectLinkRow);
}

export async function updateProjectLink(id: string, updates: {
  name?: string | null;
  memo?: string | null;
  url?: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('project_links')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteProjectLink(id: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('project_links')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}
