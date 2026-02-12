import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase';

export interface Notification {
    id: string;
    type: 'task' | 'message' | 'file' | 'deadline' | 'mention' | 'feedback';
    title: string;
    description: string;
    projectId?: string;
    projectName?: string; // Joined field
    fromUser?: {
        name: string;
        avatar?: string;
    };
    userId: string;
    isRead: boolean;
    createdAt: string;
}

export const getNotifications = async (): Promise<Notification[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('notifications')
        .select(`
      *,
      project:projects(title),
      from_user:profiles!from_user_id(name, avatar)
    `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) throw new Error(handleSupabaseError(error));

    return data.map((n: any) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        description: n.description,
        projectId: n.project_id,
        projectName: n.project?.title,
        fromUser: n.from_user ? {
            name: n.from_user.name,
            avatar: n.from_user.avatar
        } : undefined,
        userId: n.user_id,
        isRead: n.is_read,
        createdAt: n.created_at
    }));
};

export const markAsRead = async (id: string) => {
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

    if (error) throw new Error(handleSupabaseError(error));
};

export const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id);

    if (error) throw new Error(handleSupabaseError(error));
};

export const deleteNotification = async (id: string) => {
    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

    if (error) throw new Error(handleSupabaseError(error));
};
