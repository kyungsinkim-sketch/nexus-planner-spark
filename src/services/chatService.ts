import { supabase, isSupabaseConfigured, handleSupabaseError } from '@/lib/supabase';
import type { ChatMessage } from '@/types/core';
import type { Database } from '@/types/database';

type MessageRow = Database['public']['Tables']['chat_messages']['Row'];
type MessageInsert = Database['public']['Tables']['chat_messages']['Insert'];

// Transform database row to app ChatMessage type
const transformMessage = (row: MessageRow): ChatMessage => {
    return {
        id: row.id,
        projectId: row.project_id || '',
        userId: row.user_id,
        content: row.content,
        createdAt: row.created_at,
        attachmentId: row.attachment_id || undefined,
        directChatUserId: row.direct_chat_user_id || undefined,
        messageType: (row as any).message_type || 'text',
        locationData: (row as any).location_data || undefined,
        scheduleData: (row as any).schedule_data || undefined,
        decisionData: (row as any).decision_data || undefined,
    };
};

// Get messages by project
export const getMessagesByProject = async (projectId: string): Promise<ChatMessage[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return data.map(transformMessage);
};

// Get direct messages between two users
export const getDirectMessages = async (
    userId1: string,
    userId2: string
): Promise<ChatMessage[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .or(`and(user_id.eq.${userId1},direct_chat_user_id.eq.${userId2}),and(user_id.eq.${userId2},direct_chat_user_id.eq.${userId1})`)
        .order('created_at', { ascending: true });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return data.map(transformMessage);
};

// Send message to project
export const sendProjectMessage = async (
    projectId: string,
    userId: string,
    content: string,
    attachmentId?: string
): Promise<ChatMessage> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const insertData: MessageInsert = {
        project_id: projectId,
        user_id: userId,
        content,
        attachment_id: attachmentId || null,
    };

    const { data, error } = await supabase
        .from('chat_messages')
        .insert(insertData as unknown as Record<string, unknown>)
        .select()
        .single();

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return transformMessage(data);
};

// Send direct message
export const sendDirectMessage = async (
    fromUserId: string,
    toUserId: string,
    content: string,
    attachmentId?: string
): Promise<ChatMessage> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const insertData: MessageInsert = {
        user_id: fromUserId,
        direct_chat_user_id: toUserId,
        content,
        attachment_id: attachmentId || null,
    };

    const { data, error } = await supabase
        .from('chat_messages')
        .insert(insertData as unknown as Record<string, unknown>)
        .select()
        .single();

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return transformMessage(data);
};

// Delete message
export const deleteMessage = async (messageId: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', messageId);

    if (error) {
        throw new Error(handleSupabaseError(error));
    }
};

// Subscribe to project messages (realtime)
export const subscribeToProjectMessages = (
    projectId: string,
    callback: (message: ChatMessage) => void
) => {
    if (!isSupabaseConfigured()) {
        console.warn('Supabase not configured, realtime disabled');
        return () => { };
    }

    const channel = supabase
        .channel(`project_messages_${projectId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `project_id=eq.${projectId}`,
            },
            (payload) => {
                callback(transformMessage(payload.new as MessageRow));
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};

// Subscribe to direct messages (realtime)
export const subscribeToDirectMessages = (
    userId1: string,
    userId2: string,
    callback: (message: ChatMessage) => void
) => {
    if (!isSupabaseConfigured()) {
        console.warn('Supabase not configured, realtime disabled');
        return () => { };
    }

    const channel = supabase
        .channel(`direct_messages_${userId1}_${userId2}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `user_id=eq.${userId1},direct_chat_user_id=eq.${userId2}`,
            },
            (payload) => {
                callback(transformMessage(payload.new as MessageRow));
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `user_id=eq.${userId2},direct_chat_user_id=eq.${userId1}`,
            },
            (payload) => {
                callback(transformMessage(payload.new as MessageRow));
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};

// Get recent conversations for a user
export const getRecentConversations = async (userId: string): Promise<{
    projectChats: { projectId: string; lastMessage: ChatMessage }[];
    directChats: { userId: string; lastMessage: ChatMessage }[];
}> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    // Get project chats
    const { data: projectData, error: projectError } = await supabase
        .from('chat_messages')
        .select('*')
        .not('project_id', 'is', null)
        .order('created_at', { ascending: false });

    if (projectError) {
        throw new Error(handleSupabaseError(projectError));
    }

    // Get direct chats
    const { data: directData, error: directError } = await supabase
        .from('chat_messages')
        .select('*')
        .or(`user_id.eq.${userId},direct_chat_user_id.eq.${userId}`)
        .not('direct_chat_user_id', 'is', null)
        .order('created_at', { ascending: false });

    if (directError) {
        throw new Error(handleSupabaseError(directError));
    }

    // Group by project
    const projectChatsMap = new Map<string, ChatMessage>();
    (projectData as MessageRow[]).forEach((msg) => {
        if (msg.project_id && !projectChatsMap.has(msg.project_id)) {
            projectChatsMap.set(msg.project_id, transformMessage(msg));
        }
    });

    // Group by user
    const directChatsMap = new Map<string, ChatMessage>();
    (directData as MessageRow[]).forEach((msg) => {
        const otherUserId = msg.user_id === userId ? msg.direct_chat_user_id : msg.user_id;
        if (otherUserId && !directChatsMap.has(otherUserId)) {
            directChatsMap.set(otherUserId, transformMessage(msg));
        }
    });

    return {
        projectChats: Array.from(projectChatsMap.entries()).map(([projectId, lastMessage]) => ({
            projectId,
            lastMessage,
        })),
        directChats: Array.from(directChatsMap.entries()).map(([userId, lastMessage]) => ({
            userId,
            lastMessage,
        })),
    };
};
