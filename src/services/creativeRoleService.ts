/**
 * Creative Role Service
 * Manages creative roles and project team member role assignments.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { CreativeRole, ProjectTeamMember } from '@/types/core';

// ─── Transform helpers ───

function transformRole(row: Record<string, unknown>): CreativeRole {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as CreativeRole['category'],
    sortOrder: (row.sort_order as number) ?? 0,
    isActive: (row.is_active as boolean) ?? true,
  };
}

function transformMember(row: Record<string, unknown>): ProjectTeamMember {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    userId: row.user_id as string,
    creativeRoleId: (row.creative_role_id as string) ?? undefined,
    creativeRole: row.creative_roles ? transformRole(row.creative_roles as Record<string, unknown>) : undefined,
    addedAt: row.added_at as string,
  };
}

// ─── Creative Roles ───

export async function getCreativeRoles(): Promise<CreativeRole[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('creative_roles')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return (data || []).map(transformRole);
}

/** Group roles by category for dropdown display */
export function groupRolesByCategory(roles: CreativeRole[]): Record<string, CreativeRole[]> {
  const groups: Record<string, CreativeRole[]> = {};
  for (const role of roles) {
    if (!groups[role.category]) groups[role.category] = [];
    groups[role.category].push(role);
  }
  return groups;
}

// ─── Project Team Members ───

export async function getProjectTeamMembers(projectId: string): Promise<ProjectTeamMember[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('project_team_members')
    .select('*, creative_roles(*)')
    .eq('project_id', projectId);
  if (error) throw error;
  return (data || []).map(transformMember);
}

export async function addProjectTeamMember(
  projectId: string,
  userId: string,
  creativeRoleId?: string,
  addedBy?: string,
): Promise<ProjectTeamMember> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

  // If no role specified, try to use user's default
  let roleId = creativeRoleId;
  if (!roleId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('default_creative_role_id')
      .eq('id', userId)
      .maybeSingle();
    if (profile?.default_creative_role_id) {
      roleId = profile.default_creative_role_id;
    }
  }

  const { data, error } = await supabase
    .from('project_team_members')
    .upsert({
      project_id: projectId,
      user_id: userId,
      creative_role_id: roleId || null,
      added_by: addedBy || null,
    }, { onConflict: 'project_id,user_id' })
    .select('*, creative_roles(*)')
    .single();
  if (error) throw error;
  return transformMember(data);
}

export async function updateProjectMemberRole(
  projectId: string,
  userId: string,
  creativeRoleId: string | null,
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase
    .from('project_team_members')
    .update({ creative_role_id: creativeRoleId })
    .eq('project_id', projectId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function removeProjectTeamMember(projectId: string, userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase
    .from('project_team_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId);
  if (error) throw error;
}

// ─── Add custom role ───

export async function addCreativeRole(name: string, category: string): Promise<CreativeRole> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  // Get max sort_order for this category
  const { data: existing } = await supabase
    .from('creative_roles')
    .select('sort_order')
    .eq('category', category)
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextOrder = existing && existing.length > 0 ? (existing[0].sort_order as number) + 1 : 50;
  const { data, error } = await supabase
    .from('creative_roles')
    .insert({ name, category, sort_order: nextOrder, is_active: true })
    .select('*')
    .single();
  if (error) throw error;
  return transformRole(data);
}

// ─── Profile default role ───

export async function setDefaultCreativeRole(userId: string, roleId: string | null): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase
    .from('profiles')
    .update({ default_creative_role_id: roleId })
    .eq('id', userId);
  if (error) throw error;
}
