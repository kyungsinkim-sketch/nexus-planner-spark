import { supabase, isSupabaseConfigured, handleSupabaseError } from '@/lib/supabase';
import type { ChatMessage, ChatRoom, ChatRoomMember, ChatMessageType, LocationShare, ScheduleShare, DecisionShare } from '@/types/core';
import type { Database } from '@/types/database';

type MessageRow = Database['public']['Tables']['chat_messages']['Row'];
type MessageInsert = Database['public']['Tables']['chat_messages']['Insert'];
type RoomRow = Database['public']['Tables']['chat_rooms']['Row'];
type RoomMemberRow = Database['public']['Tables']['chat_room_members']['Row'];

// ============================================================
// Transform helpers
// ============================================================

const transformMessage = (row: MessageRow): ChatMessage => {
    return {
        id: row.id,
        projectId: row.project_id || '',
        userId: row.user_id,
        content: row.content,
        createdAt: row.created_at,
        attachmentId: row.attachment_id || undefined,
        directChatUserId: row.direct_chat_user_id || undefined,
        roomId: row.room_id || undefined,
        messageType: (row.message_type || 'text') as ChatMessageType,
        locationData: row.location_data as unknown as LocationShare | undefined,
        scheduleData: row.schedule_data as unknown as ScheduleShare | undefined,
        decisionData: row.decision_data as unknown as DecisionShare | undefined,
    };
};

const transformRoom = (row: RoomRow): ChatRoom => {
    return {
        id: row.id,
        projectId: row.project_id,
        name: row.name,
        description: row.description || undefined,
        isDefault: row.is_default,
        createdBy: row.created_by || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

const transformRoomMember = (row: RoomMemberRow): ChatRoomMember => {
    return {
        roomId: row.room_id,
        userId: row.user_id,
        joinedAt: row.joined_at,
    };
};

// ============================================================
// Chat Room functions
// ============================================================

// Get all chat rooms for a project
export const getRoomsByProject = async (projectId: string): Promise<ChatRoom[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('project_id', projectId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return (data as RoomRow[]).map(transformRoom);
};

// Create a new chat room in a project
export const createRoom = async (
    projectId: string,
    name: string,
    createdBy: string,
    description?: string,
    memberIds?: string[]
): Promise<ChatRoom> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    // Create the room
    const { data: roomData, error: roomError } = await supabase
        .from('chat_rooms')
        .insert({
            project_id: projectId,
            name,
            description: description || null,
            is_default: false,
            created_by: createdBy,
        } as unknown as Record<string, unknown>)
        .select()
        .single();

    if (roomError) {
        throw new Error(handleSupabaseError(roomError));
    }

    const room = transformRoom(roomData as RoomRow);

    // Add members if provided
    if (memberIds && memberIds.length > 0) {
        const membersToInsert = memberIds.map(userId => ({
            room_id: room.id,
            user_id: userId,
        }));

        const { error: membersError } = await supabase
            .from('chat_room_members')
            .insert(membersToInsert as unknown as Record<string, unknown>[]);

        if (membersError) {
            console.error('Failed to add room members:', membersError);
        }
    }

    return room;
};

// Get members of a chat room
export const getRoomMembers = async (roomId: string): Promise<ChatRoomMember[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('chat_room_members')
        .select('*')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return (data as RoomMemberRow[]).map(transformRoomMember);
};

// Add a member to a chat room
export const addRoomMember = async (roomId: string, userId: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { error } = await supabase
        .from('chat_room_members')
        .insert({ room_id: roomId, user_id: userId } as unknown as Record<string, unknown>);

    if (error) {
        throw new Error(handleSupabaseError(error));
    }
};

// Remove a member from a chat room
export const removeRoomMember = async (roomId: string, userId: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { error } = await supabase
        .from('chat_room_members')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', userId);

    if (error) {
        throw new Error(handleSupabaseError(error));
    }
};

// ============================================================
// Room-based message functions
// ============================================================

// Get messages by room
export const getMessagesByRoom = async (roomId: string): Promise<ChatMessage[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return (data as MessageRow[]).map(transformMessage);
};

// Send message to a room (supports rich message types)
export const sendRoomMessage = async (
    roomId: string,
    projectId: string,
    userId: string,
    content: string,
    options?: {
        attachmentId?: string;
        messageType?: ChatMessageType;
        locationData?: LocationShare;
        scheduleData?: ScheduleShare;
        decisionData?: DecisionShare;
    }
): Promise<ChatMessage> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const insertData: MessageInsert = {
        room_id: roomId,
        project_id: projectId,
        user_id: userId,
        content,
        attachment_id: options?.attachmentId || null,
        message_type: options?.messageType || 'text',
        location_data: options?.locationData ? (options.locationData as unknown as Database['public']['Tables']['chat_messages']['Insert']['location_data']) : null,
        schedule_data: options?.scheduleData ? (options.scheduleData as unknown as Database['public']['Tables']['chat_messages']['Insert']['schedule_data']) : null,
        decision_data: options?.decisionData ? (options.decisionData as unknown as Database['public']['Tables']['chat_messages']['Insert']['decision_data']) : null,
    };

    const { data, error } = await supabase
        .from('chat_messages')
        .insert(insertData as unknown as Record<string, unknown>)
        .select()
        .single();

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return transformMessage(data as MessageRow);
};

// Subscribe to room messages (realtime)
export const subscribeToRoomMessages = (
    roomId: string,
    callback: (message: ChatMessage) => void
) => {
    if (!isSupabaseConfigured()) {
        console.warn('Supabase not configured, realtime disabled');
        return () => { };
    }

    const channel = supabase
        .channel(`room_messages_${roomId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `room_id=eq.${roomId}`,
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

// ============================================================
// Legacy project-based functions (kept for backward compat)
// ============================================================

// Get messages by project (legacy — includes all rooms)
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

    return (data as MessageRow[]).map(transformMessage);
};

// Send message to project (legacy — without room)
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

    return transformMessage(data as MessageRow);
};

// Subscribe to project messages (legacy — all rooms)
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

// ============================================================
// Direct message functions (unchanged)
// ============================================================

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

    return (data as MessageRow[]).map(transformMessage);
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

    return transformMessage(data as MessageRow);
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

// ============================================================
// Utility functions
// ============================================================

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
