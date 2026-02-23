import { supabase, isSupabaseConfigured, handleSupabaseError } from '@/lib/supabase';
import type { User, UserRole, UserWorkStatus } from '@/types/core';
import type { Database } from '@/types/database';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

// Transform database row to app User type
const transformUser = (row: ProfileRow): User => {
    return {
        id: row.id,
        name: row.name,
        email: (row as Record<string, unknown>).email as string | undefined,
        avatar: row.avatar || undefined,
        role: row.role as UserRole,
        department: row.department || undefined,
        workStatus: ((row as Record<string, unknown>).work_status as UserWorkStatus) || 'NOT_AT_WORK',
    };
};

// Sign up with email and password
export const signUp = async (
    email: string,
    password: string,
    name: string
): Promise<User> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                name,
            },
        },
    });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    if (!data.user) {
        throw new Error('Failed to create user');
    }

    // Get the created profile
    const profile = await getUserProfile(data.user.id);
    if (!profile) {
        throw new Error('Failed to create user profile');
    }

    return profile;
};

// Sign in with email and password
export const signIn = async (email: string, password: string): Promise<User> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    if (!data.user) {
        throw new Error('Failed to sign in');
    }

    const profile = await getUserProfile(data.user.id);
    if (!profile) {
        throw new Error('User profile not found');
    }

    if (data.user.email) {
        profile.email = data.user.email;
    }
    return profile;
};

// Sign out
export const signOut = async (): Promise<void> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
        throw new Error(handleSupabaseError(error));
    }
};

// Get current user
export const getCurrentUser = async (): Promise<User | null> => {
    if (!isSupabaseConfigured()) {
        return null;
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return null;
    }

    const profile = await getUserProfile(user.id);
    if (profile && user.email) {
        profile.email = user.email;
    }
    return profile;
};

// Get user profile
export const getUserProfile = async (userId: string): Promise<User | null> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            return null; // Not found
        }
        throw new Error(handleSupabaseError(error));
    }

    return transformUser(data);
};

// Get all users
export const getAllUsers = async (): Promise<User[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return data.map(transformUser);
};

// Update user profile
export const updateUserProfile = async (
    userId: string,
    updates: Partial<User>
): Promise<User> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const updateData: Record<string, unknown> = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.avatar !== undefined) updateData.avatar = updates.avatar;
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.department !== undefined) updateData.department = updates.department;

    const { data, error } = await supabase
        .from('profiles')
        .update(updateData as unknown as Record<string, unknown>)
        .eq('id', userId)
        .select()
        .single();

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return transformUser(data);
};

// Update work status
export const updateWorkStatus = async (
    userId: string,
    status: UserWorkStatus
): Promise<void> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { error } = await supabase
        .from('profiles')
        .update({ work_status: status } as unknown as Record<string, unknown>)
        .eq('id', userId);

    if (error) {
        throw new Error(handleSupabaseError(error));
    }
};

// Get user work status
export const getUserWorkStatus = async (userId: string): Promise<UserWorkStatus> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('profiles')
        .select('work_status')
        .eq('id', userId)
        .single();

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return (data as Record<string, unknown>)?.work_status as UserWorkStatus;
};

// Subscribe to auth state changes
export const onAuthStateChange = (
    callback: (user: User | null) => void
) => {
    if (!isSupabaseConfigured()) {
        console.warn('Supabase not configured, auth state changes disabled');
        return () => { };
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
            if (session?.user) {
                const profile = await getUserProfile(session.user.id);
                if (profile && session.user.email) {
                    profile.email = session.user.email;
                }
                callback(profile);
            } else {
                callback(null);
            }
        }
    );

    return () => {
        subscription.unsubscribe();
    };
};

// Reset password
export const resetPassword = async (email: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }
};

// Update password
export const updatePassword = async (newPassword: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { error } = await supabase.auth.updateUser({
        password: newPassword,
    });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }
};
