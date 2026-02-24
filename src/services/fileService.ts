import { supabase, isSupabaseConfigured, handleSupabaseError } from '@/lib/supabase';
import type { FileGroup, FileItem, FileComment } from '@/types/core';
import type { Database } from '@/types/database';

type FileGroupRow = Database['public']['Tables']['file_groups']['Row'];
type FileGroupInsert = Database['public']['Tables']['file_groups']['Insert'];
type FileItemRow = Database['public']['Tables']['file_items']['Row'];
type FileItemInsert = Database['public']['Tables']['file_items']['Insert'];
type FileCommentRow = Database['public']['Tables']['file_comments']['Row'];
type FileCommentInsert = Database['public']['Tables']['file_comments']['Insert'];

// Transform database row to app FileGroup type
const transformFileGroup = (row: FileGroupRow): FileGroup => {
    return {
        id: row.id,
        projectId: row.project_id,
        category: row.category,
        title: row.title,
    };
};

// Transform database row to app FileItem type
const transformFileItem = (row: FileItemRow): FileItem => {
    return {
        id: row.id,
        fileGroupId: row.file_group_id,
        name: row.name,
        uploadedBy: row.uploaded_by,
        createdAt: row.created_at,
        size: row.size || undefined,
        type: row.type || undefined,
        isImportant: row.is_important || false,
        source: row.source || 'UPLOAD',
        comment: row.comment || undefined,
        storagePath: row.storage_path || undefined,
    };
};

// Get file groups by project
export const getFileGroupsByProject = async (projectId: string): Promise<FileGroup[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('file_groups')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return data.map(transformFileGroup);
};

// Create file group
export const createFileGroup = async (fileGroup: Partial<FileGroup>): Promise<FileGroup> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const insertData: FileGroupInsert = {
        project_id: fileGroup.projectId!,
        category: fileGroup.category!,
        title: fileGroup.title!,
    };

    const { data, error } = await supabase
        .from('file_groups')
        .insert(insertData as unknown as Record<string, unknown>)
        .select()
        .single();

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return transformFileGroup(data as FileGroupRow);
};

// Get files by group
export const getFilesByGroup = async (fileGroupId: string): Promise<FileItem[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('file_items')
        .select('*')
        .eq('file_group_id', fileGroupId)
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return data.map(transformFileItem);
};

// Get ALL files for a project — includes grouped files AND chat-uploaded files
// Chat files are found via chat_messages with attachment_id in the same project
export const getFilesByProject = async (projectId: string): Promise<FileItem[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    // 1. Get all file_group IDs for this project
    const { data: groups, error: groupErr } = await supabase
        .from('file_groups')
        .select('id')
        .eq('project_id', projectId);

    if (groupErr) throw new Error(handleSupabaseError(groupErr));

    const groupIds = (groups || []).map(g => g.id);

    // 2. Get all files in these groups
    let groupedFiles: FileItem[] = [];
    if (groupIds.length > 0) {
        const { data: gFiles, error: gErr } = await supabase
            .from('file_items')
            .select('*')
            .in('file_group_id', groupIds)
            .order('created_at', { ascending: false });

        if (gErr) throw new Error(handleSupabaseError(gErr));
        groupedFiles = (gFiles || []).map(transformFileItem);
    }

    // 3. Get chat-uploaded files for this project (file_items linked via chat_messages)
    const { data: chatMsgs, error: chatErr } = await supabase
        .from('chat_messages')
        .select('attachment_id')
        .eq('project_id', projectId)
        .eq('message_type', 'file')
        .not('attachment_id', 'is', null);

    if (chatErr) throw new Error(handleSupabaseError(chatErr));

    const chatFileIds = (chatMsgs || [])
        .map(m => m.attachment_id)
        .filter(Boolean) as string[];

    // Filter out IDs already in grouped files
    const groupedFileIds = new Set(groupedFiles.map(f => f.id));
    const ungroupedChatFileIds = chatFileIds.filter(id => !groupedFileIds.has(id));

    let chatFiles: FileItem[] = [];
    if (ungroupedChatFileIds.length > 0) {
        const { data: cFiles, error: cErr } = await supabase
            .from('file_items')
            .select('*')
            .in('id', ungroupedChatFileIds)
            .order('created_at', { ascending: false });

        if (cErr) throw new Error(handleSupabaseError(cErr));
        chatFiles = (cFiles || []).map(transformFileItem);
    }

    return [...groupedFiles, ...chatFiles];
};

// Upload file metadata
export const createFileItem = async (fileItem: Partial<FileItem>): Promise<FileItem> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const insertData: FileItemInsert = {
        file_group_id: fileItem.fileGroupId || undefined,
        name: fileItem.name!,
        uploaded_by: fileItem.uploadedBy!,
        size: fileItem.size || null,
        type: fileItem.type || null,
        is_important: fileItem.isImportant || false,
        source: fileItem.source || 'UPLOAD',
        comment: fileItem.comment || null,
        storage_path: fileItem.storagePath || null,
    };

    const { data, error } = await supabase
        .from('file_items')
        .insert(insertData as unknown as Record<string, unknown>)
        .select()
        .single();

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return transformFileItem(data as FileItemRow);
};

// Maximum file upload size: 50MB
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// Upload file to storage
export const uploadFile = async (
    file: File,
    projectId: string,
    userId: string
): Promise<{ path: string; url: string }> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    // Pre-validate file size before uploading to save bandwidth
    if (file.size > MAX_FILE_SIZE_BYTES) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        throw new Error(`파일 크기(${sizeMB}MB)가 최대 업로드 크기(50MB)를 초과합니다.`);
    }

    // Reject empty files
    if (file.size === 0) {
        throw new Error('빈 파일은 업로드할 수 없습니다.');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${projectId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(filePath, file);

    if (uploadError) {
        // Provide user-friendly message for common storage errors
        const errMsg = uploadError.message || '';
        if (errMsg.includes('exceeded the maximum allowed size') || errMsg.includes('Payload too large')) {
            throw new Error('File is too large. Maximum upload size is 50MB.');
        }
        if (errMsg.includes('<!DOCTYPE') || errMsg.includes('is not valid JSON')) {
            throw new Error('Upload timed out. The file may be too large. Maximum size is 50MB.');
        }
        throw new Error(handleSupabaseError(uploadError));
    }

    const { data: { publicUrl } } = supabase.storage
        .from('project-files')
        .getPublicUrl(filePath);

    return { path: filePath, url: publicUrl };
};

// Get download URL for a file
export const getFileDownloadUrl = (storagePath: string): string => {
    const { data: { publicUrl } } = supabase.storage
        .from('project-files')
        .getPublicUrl(storagePath);
    return publicUrl;
};

// Delete file from storage
export const deleteFile = async (filePath: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { error } = await supabase.storage
        .from('project-files')
        .remove([filePath]);

    if (error) {
        throw new Error(handleSupabaseError(error));
    }
};

// Delete file item metadata
export const deleteFileItem = async (id: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { error } = await supabase
        .from('file_items')
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error(handleSupabaseError(error));
    }
};

// Update file item
export const updateFileItem = async (
    id: string,
    updates: Partial<FileItem>
): Promise<FileItem> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.isImportant !== undefined) updateData.is_important = updates.isImportant;
    if (updates.comment !== undefined) updateData.comment = updates.comment;
    if (updates.fileGroupId !== undefined) updateData.file_group_id = updates.fileGroupId;

    const { data, error } = await supabase
        .from('file_items')
        .update(updateData as unknown as Record<string, unknown>)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return transformFileItem(data);
};

// ─── File Comments ───

const transformFileComment = (row: FileCommentRow): FileComment => ({
    id: row.id,
    fileItemId: row.file_item_id,
    userId: row.user_id,
    content: row.content,
    createdAt: row.created_at,
});

// Get all comments for a file
export const getFileComments = async (fileItemId: string): Promise<FileComment[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('file_comments')
        .select('*')
        .eq('file_item_id', fileItemId)
        .order('created_at', { ascending: true });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return data.map(transformFileComment);
};

// Create a comment on a file
export const createFileComment = async (
    fileItemId: string,
    userId: string,
    content: string,
): Promise<FileComment> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const insertData: FileCommentInsert = {
        file_item_id: fileItemId,
        user_id: userId,
        content,
    };

    const { data, error } = await supabase
        .from('file_comments')
        .insert(insertData as unknown as Record<string, unknown>)
        .select()
        .single();

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return transformFileComment(data as FileCommentRow);
};

// Delete a comment
export const deleteFileComment = async (commentId: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { error } = await supabase
        .from('file_comments')
        .delete()
        .eq('id', commentId);

    if (error) {
        throw new Error(handleSupabaseError(error));
    }
};

// ─── Realtime Subscriptions ───

/**
 * Subscribe to file_items changes (INSERT, UPDATE, DELETE).
 * Used to sync file list across users in real-time.
 */
export const subscribeToFileItems = (
    onInsert: (file: FileItem) => void,
    onUpdate: (file: FileItem) => void,
    onDelete: (id: string) => void,
): (() => void) => {
    if (!isSupabaseConfigured()) {
        return () => {};
    }

    const channelName = `file_items_changes_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const channel = supabase
        .channel(channelName)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'file_items',
            },
            (payload) => {
                if (payload.eventType === 'INSERT' && payload.new) {
                    onInsert(transformFileItem(payload.new as FileItemRow));
                } else if (payload.eventType === 'UPDATE' && payload.new) {
                    onUpdate(transformFileItem(payload.new as FileItemRow));
                } else if (payload.eventType === 'DELETE' && payload.old) {
                    onDelete((payload.old as { id: string }).id);
                }
            },
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};

/**
 * Subscribe to file_comments changes for a specific file.
 * Notifies when comments are added/deleted on the file.
 */
export const subscribeToFileComments = (
    fileItemId: string,
    onInsert: (comment: FileComment) => void,
    onDelete: (commentId: string) => void,
): (() => void) => {
    if (!isSupabaseConfigured()) {
        return () => {};
    }

    const channelName = `file_comments_${fileItemId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const channel = supabase
        .channel(channelName)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'file_comments',
                filter: `file_item_id=eq.${fileItemId}`,
            },
            (payload) => {
                if (payload.eventType === 'INSERT' && payload.new) {
                    onInsert(transformFileComment(payload.new as FileCommentRow));
                } else if (payload.eventType === 'DELETE' && payload.old) {
                    onDelete((payload.old as { id: string }).id);
                }
            },
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};
