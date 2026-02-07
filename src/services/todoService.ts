import { supabase, isSupabaseConfigured, handleSupabaseError } from '@/lib/supabase';
import type { PersonalTodo } from '@/types/core';
import type { Database } from '@/types/database';

type TodoRow = Database['public']['Tables']['personal_todos']['Row'];
type TodoInsert = Database['public']['Tables']['personal_todos']['Insert'];
type TodoUpdate = Database['public']['Tables']['personal_todos']['Update'];

// Transform database row to app PersonalTodo type
const transformTodo = (row: TodoRow): PersonalTodo => {
    return {
        id: row.id,
        title: row.title,
        assigneeIds: row.assignee_ids || [],
        requestedById: row.requested_by_id,
        projectId: row.project_id || undefined,
        dueDate: row.due_date,
        priority: row.priority,
        status: row.status,
        createdAt: row.created_at,
        completedAt: row.completed_at || undefined,
        sourceTaskId: row.source_task_id || undefined,
    };
};

// Transform app PersonalTodo to database insert
const transformToInsert = (todo: Partial<PersonalTodo>): TodoInsert => {
    return {
        title: todo.title!,
        assignee_ids: todo.assigneeIds || [],
        requested_by_id: todo.requestedById!,
        project_id: todo.projectId || null,
        due_date: todo.dueDate!,
        priority: todo.priority || 'NORMAL',
        status: todo.status || 'PENDING',
        source_task_id: todo.sourceTaskId || null,
    };
};

// Get all todos
export const getTodos = async (): Promise<PersonalTodo[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('personal_todos')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return data.map(transformTodo);
};

// Get todos by assignee
export const getTodosByAssignee = async (assigneeId: string): Promise<PersonalTodo[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('personal_todos')
        .select('*')
        .contains('assignee_ids', [assigneeId])
        .order('due_date', { ascending: true });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return data.map(transformTodo);
};

// Get todos by project
export const getTodosByProject = async (projectId: string): Promise<PersonalTodo[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('personal_todos')
        .select('*')
        .eq('project_id', projectId)
        .order('due_date', { ascending: true });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return data.map(transformTodo);
};

// Create todo
export const createTodo = async (todo: Partial<PersonalTodo>): Promise<PersonalTodo> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const insertData = transformToInsert(todo);

    const { data, error } = await supabase
        .from('personal_todos')
        .insert(insertData as any)
        .select()
        .single();

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return transformTodo(data);
};

// Update todo
export const updateTodo = async (
    id: string,
    updates: Partial<PersonalTodo>
): Promise<PersonalTodo> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const updateData: TodoUpdate = {};

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.assigneeIds !== undefined) updateData.assignee_ids = updates.assigneeIds;
    if (updates.requestedById !== undefined) updateData.requested_by_id = updates.requestedById;
    if (updates.projectId !== undefined) updateData.project_id = updates.projectId;
    if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt;
    if (updates.sourceTaskId !== undefined) updateData.source_task_id = updates.sourceTaskId;

    const { data, error } = await supabase
        .from('personal_todos')
        .update(updateData as any)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return transformTodo(data);
};

// Delete todo
export const deleteTodo = async (id: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { error } = await supabase
        .from('personal_todos')
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error(handleSupabaseError(error));
    }
};

// Mark todo as completed
export const completeTodo = async (id: string): Promise<PersonalTodo> => {
    return updateTodo(id, {
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
    });
};

// Subscribe to todo changes (realtime)
export const subscribeToTodos = (
    callback: (todo: PersonalTodo) => void
) => {
    if (!isSupabaseConfigured()) {
        console.warn('Supabase not configured, realtime disabled');
        return () => { };
    }

    const channel = supabase
        .channel('personal_todos_changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'personal_todos',
            },
            (payload) => {
                if (payload.new) {
                    callback(transformTodo(payload.new as TodoRow));
                }
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};
