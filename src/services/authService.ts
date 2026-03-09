import { supabase, isSupabaseConfigured, handleSupabaseError } from '@/lib/supabase';
import type { User, UserRole, UserWorkStatus } from '@/types/core';
import type { Database } from '@/types/database';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

// Transform database row to app User type
// If last_active_at is older than 30 minutes, override workStatus to NOT_AT_WORK
const transformUser = (row: ProfileRow): User => {
    const raw = row as Record<string, unknown>;
    let workStatus = (raw.work_status as UserWorkStatus) || 'NOT_AT_WORK';
    const lastActiveAt = raw.last_active_at as string | undefined;

    // Stale detection: if user hasn't sent a heartbeat in 30 min, treat as offline
    if (lastActiveAt && workStatus !== 'NOT_AT_WORK') {
        const elapsed = Date.now() - new Date(lastActiveAt).getTime();
        if (elapsed > STALE_THRESHOLD_MS) {
            workStatus = 'NOT_AT_WORK';
        }
    }

    return {
        id: row.id,
        name: row.name,
        email: raw.email as string | undefined,
        avatar: row.avatar || undefined,
        role: row.role as UserRole,
        department: row.department || undefined,
        workStatus,
        lastActiveAt,
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
        // Enrich with org chart data (position, department, team)
        const { data: emp } = await supabase
            .from('nexus_employees')
            .select('position,department,team')
            .eq('email', user.email.toLowerCase())
            .single();
        if (emp) {
            profile.position = emp.position || profile.position;
            profile.department = emp.department || profile.department;
            profile.team = emp.team || profile.team;
        }
        // Load organization name via memberships (error-safe)
        try {
            const { data: membership } = await supabase
                .from('memberships')
                .select('org_id')
                .eq('user_id', user.id)
                .limit(1)
                .single();
            if (membership?.org_id) {
                const { data: org } = await supabase
                    .from('organizations')
                    .select('name')
                    .eq('id', membership.org_id)
                    .single();
                if (org?.name) {
                    profile.organizationName = org.name;
                }
            }
        } catch {
            // RLS may block — silently skip
        }
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

    // Load profiles, org chart employees, and org memberships in parallel
    const [profilesResult, employeesResult, membershipsResult, orgsResult] = await Promise.all([
        supabase.from('profiles').select('*').order('name', { ascending: true }),
        supabase.from('nexus_employees').select('email,position,department,team'),
        supabase.from('memberships').select('user_id,org_id'),
        supabase.from('organizations').select('id,name'),
    ]);

    if (profilesResult.error) {
        throw new Error(handleSupabaseError(profilesResult.error));
    }

    // Build email→employee lookup for org chart data
    const empByEmail = new Map<string, { position: string; department: string; team?: string }>();
    if (employeesResult.data) {
        for (const emp of employeesResult.data) {
            if (emp.email) {
                empByEmail.set(emp.email.toLowerCase(), {
                    position: emp.position,
                    department: emp.department,
                    team: emp.team || undefined,
                });
            }
        }
    }

    // Build org lookup: orgId → name, userId → orgId
    const orgNameMap = new Map<string, string>();
    if (orgsResult.data) {
        for (const org of orgsResult.data) orgNameMap.set(org.id, org.name);
    }
    const userOrgMap = new Map<string, string>();
    if (membershipsResult.data) {
        for (const m of membershipsResult.data) {
            if (!userOrgMap.has(m.user_id)) userOrgMap.set(m.user_id, m.org_id);
        }
    }

    return profilesResult.data.map(row => {
        const user = transformUser(row);
        // Enrich with org chart data via email match
        if (user.email) {
            const emp = empByEmail.get(user.email.toLowerCase());
            if (emp) {
                user.position = emp.position;
                user.department = emp.department;
                user.team = emp.team;
            }
        }
        // Enrich with organization name
        const orgId = userOrgMap.get(user.id);
        if (orgId) user.organizationName = orgNameMap.get(orgId);
        return user;
    });
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

// Update work status (also updates last_active_at for heartbeat)
export const updateWorkStatus = async (
    userId: string,
    status: UserWorkStatus
): Promise<void> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { error } = await supabase
        .from('profiles')
        .update({
            work_status: status,
            last_active_at: new Date().toISOString(),
        } as unknown as Record<string, unknown>)
        .eq('id', userId);

    if (error) {
        throw new Error(handleSupabaseError(error));
    }
};

// Heartbeat — update last_active_at without changing work_status
export const sendHeartbeat = async (userId: string): Promise<void> => {
    if (!isSupabaseConfigured()) return;

    try {
        await supabase
            .from('profiles')
            .update({
                last_active_at: new Date().toISOString(),
            } as unknown as Record<string, unknown>)
            .eq('id', userId);
    } catch {
        // Best effort, silently fail
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
