import { supabase, isSupabaseConfigured, handleSupabaseError } from '@/lib/supabase';
import { withSupabaseRetry } from '@/lib/retry';
import type { Project } from '@/types/core';
import type { Database } from '@/types/database';

type ProjectRow = Database['public']['Tables']['projects']['Row'];
type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

// Transform database row to app Project type
const transformProject = (row: ProjectRow): Project => {
    return {
        id: row.id,
        title: row.title,
        client: row.client,
        status: row.status,
        type: row.type || undefined,
        priority: row.priority || undefined,
        startDate: row.start_date,
        endDate: row.end_date,
        description: row.description || undefined,
        progress: row.progress || undefined,
        pmId: row.pm_id || undefined,
        teamMemberIds: row.team_member_ids || undefined,
        lastActivityAt: row.last_activity_at || undefined,
        health: row.health_schedule ? {
            schedule: row.health_schedule,
            workload: row.health_workload || 'BALANCED',
            budget: row.health_budget || 'HEALTHY',
        } : undefined,
        tasksCompleted: row.tasks_completed || undefined,
        tasksTotal: row.tasks_total || undefined,
        budget: row.budget ? Number(row.budget) : undefined,
        currency: row.currency || undefined,
        isLocked: row.is_locked || undefined,
        feedbackStatus: row.feedback_status || undefined,
        thumbnail: row.thumbnail || undefined,
        keyColor: row.key_color || undefined,
    };
};

// Transform app Project to database insert
const transformToInsert = (project: Partial<Project>): ProjectInsert => {
    return {
        title: project.title!,
        client: project.client!,
        status: project.status || 'ACTIVE',
        type: project.type || null,
        priority: project.priority || null,
        start_date: project.startDate!,
        end_date: project.endDate!,
        description: project.description || null,
        progress: project.progress || 0,
        pm_id: project.pmId || null,
        team_member_ids: project.teamMemberIds || null,
        health_schedule: project.health?.schedule || null,
        health_workload: project.health?.workload || null,
        health_budget: project.health?.budget || null,
        tasks_completed: project.tasksCompleted || 0,
        tasks_total: project.tasksTotal || 0,
        budget: project.budget || null,
        currency: project.currency || 'KRW',
        is_locked: project.isLocked || false,
        feedback_status: project.feedbackStatus || null,
        thumbnail: project.thumbnail || null,
        key_color: project.keyColor || null,
    };
};

// Get all projects
export const getProjects = async (): Promise<Project[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await withSupabaseRetry(
        () => supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false }),
        { label: 'getProjects' },
    );

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return data.map(transformProject);
};

// Get project by ID
export const getProjectById = async (id: string): Promise<Project | null> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await withSupabaseRetry(
        () => supabase
            .from('projects')
            .select('*')
            .eq('id', id)
            .single(),
        { label: 'getProjectById' },
    );

    if (error) {
        if (error.code === 'PGRST116') {
            return null; // Not found
        }
        throw new Error(handleSupabaseError(error));
    }

    return transformProject(data);
};

// Create project
export const createProject = async (project: Partial<Project>): Promise<Project> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const insertData = transformToInsert(project);

    const { data, error } = await supabase
        .from('projects')
        .insert(insertData)
        .select()
        .single();

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return transformProject(data);
};

// Update project
export const updateProject = async (
    id: string,
    updates: Partial<Project>
): Promise<Project> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const updateData: ProjectUpdate = {};

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.client !== undefined) updateData.client = updates.client;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.startDate !== undefined) updateData.start_date = updates.startDate;
    if (updates.endDate !== undefined) updateData.end_date = updates.endDate;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.progress !== undefined) updateData.progress = updates.progress;
    if (updates.pmId !== undefined) updateData.pm_id = updates.pmId;
    if (updates.teamMemberIds !== undefined) updateData.team_member_ids = updates.teamMemberIds;
    if (updates.health?.schedule !== undefined) updateData.health_schedule = updates.health.schedule;
    if (updates.health?.workload !== undefined) updateData.health_workload = updates.health.workload;
    if (updates.health?.budget !== undefined) updateData.health_budget = updates.health.budget;
    if (updates.tasksCompleted !== undefined) updateData.tasks_completed = updates.tasksCompleted;
    if (updates.tasksTotal !== undefined) updateData.tasks_total = updates.tasksTotal;
    if (updates.budget !== undefined) updateData.budget = updates.budget;
    if (updates.currency !== undefined) updateData.currency = updates.currency;
    if (updates.isLocked !== undefined) updateData.is_locked = updates.isLocked;
    if (updates.feedbackStatus !== undefined) updateData.feedback_status = updates.feedbackStatus;
    if (updates.thumbnail !== undefined) updateData.thumbnail = updates.thumbnail;
    if (updates.keyColor !== undefined) updateData.key_color = updates.keyColor;

    // Always update last_activity_at
    updateData.last_activity_at = new Date().toISOString();

    const { data, error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', id)
        .select();

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    if (!data || data.length === 0) {
        throw new Error('Project not found or you do not have permission to update it');
    }

    return transformProject(data[0]);
};

// Delete project
export const deleteProject = async (id: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error(handleSupabaseError(error));
    }
};

// Get projects by status
export const getProjectsByStatus = async (
    status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
): Promise<Project[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return data.map(transformProject);
};

// Get projects by PM
export const getProjectsByPM = async (pmId: string): Promise<Project[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('pm_id', pmId)
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return data.map(transformProject);
};
