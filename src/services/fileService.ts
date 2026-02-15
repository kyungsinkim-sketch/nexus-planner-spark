import { supabase, isSupabaseConfigured, handleSupabaseError } from '@/lib/supabase';
import type { FileGroup, FileItem } from '@/types/core';
import type { Database } from '@/types/database';

type FileGroupRow = Database['public']['Tables']['file_groups']['Row'];
type FileGroupInsert = Database['public']['Tables']['file_groups']['Insert'];
type FileItemRow = Database['public']['Tables']['file_items']['Row'];
type FileItemInsert = Database['public']['Tables']['file_items']['Insert'];

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

// Upload file to storage
export const uploadFile = async (
    file: File,
    projectId: string,
    userId: string
): Promise<{ path: string; url: string }> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
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
        if (errMsg.includes('exceeded the maximum allowed size')) {
            throw new Error('File is too large. Maximum upload size is 100MB.');
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
