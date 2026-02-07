import { supabase, isSupabaseConfigured, handleSupabaseError } from '@/lib/supabase';
import type { Database } from '@/types/database';

// ============================================
// TYPES
// ============================================

export interface TrainingSession {
    id: string;
    userId: string;
    userName?: string; // Joined from profiles
    date: string;
    timeSlot: string;
    exerciseContent?: string;
    trainerConfirmed: boolean;
    traineeConfirmed: boolean;
    calendarEventId?: string;
    createdAt: string;
    updatedAt: string;
}

export interface LockerAssignment {
    lockerNumber: number;
    userId: string;
    userName?: string; // Joined from profiles
    assignedDate: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateTrainingSessionInput {
    userId: string;
    date: string;
    timeSlot: string;
    exerciseContent?: string;
    calendarEventId?: string;
}

export interface UpdateTrainingSessionInput {
    exerciseContent?: string;
    trainerConfirmed?: boolean;
    traineeConfirmed?: boolean;
}

export interface CreateLockerAssignmentInput {
    lockerNumber: number;
    userId: string;
}

export interface MonthlyStats {
    monthlyCount: number;
    totalCount: number;
}

type TrainingSessionRow = Database['public']['Tables']['training_sessions']['Row'];
type TrainingSessionInsert = Database['public']['Tables']['training_sessions']['Insert'];
type TrainingSessionUpdate = Database['public']['Tables']['training_sessions']['Update'];

type LockerAssignmentRow = Database['public']['Tables']['locker_assignments']['Row'];
type LockerAssignmentInsert = Database['public']['Tables']['locker_assignments']['Insert'];

// ============================================
// TRANSFORM FUNCTIONS
// ============================================

const transformTrainingSession = (row: any): TrainingSession => {
    return {
        id: row.id,
        userId: row.user_id,
        userName: row.profiles?.name,
        date: row.date,
        timeSlot: row.time_slot,
        exerciseContent: row.exercise_content || undefined,
        trainerConfirmed: row.trainer_confirmed,
        traineeConfirmed: row.trainee_confirmed,
        calendarEventId: row.calendar_event_id || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

const transformLockerAssignment = (row: any): LockerAssignment => {
    return {
        lockerNumber: row.locker_number,
        userId: row.user_id,
        userName: row.profiles?.name,
        assignedDate: row.assigned_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

// ============================================
// TRAINING SESSIONS API
// ============================================

/**
 * Get all training sessions
 */
export const getTrainingSessions = async (): Promise<TrainingSession[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('training_sessions')
        .select(`
            *,
            profiles:user_id (
                name
            )
        `)
        .order('date', { ascending: false })
        .order('time_slot', { ascending: true });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return data.map(transformTrainingSession);
};

/**
 * Get training sessions by date
 */
export const getTrainingSessionsByDate = async (date: string): Promise<TrainingSession[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('training_sessions')
        .select(`
            *,
            profiles:user_id (
                name
            )
        `)
        .eq('date', date)
        .order('time_slot', { ascending: true });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return data.map(transformTrainingSession);
};

/**
 * Get training sessions by date range
 */
export const getTrainingSessionsByDateRange = async (
    startDate: string,
    endDate: string
): Promise<TrainingSession[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('training_sessions')
        .select(`
            *,
            profiles:user_id (
                name
            )
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
        .order('time_slot', { ascending: true });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return data.map(transformTrainingSession);
};

/**
 * Get training sessions by user
 */
export const getTrainingSessionsByUser = async (userId: string): Promise<TrainingSession[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('training_sessions')
        .select(`
            *,
            profiles:user_id (
                name
            )
        `)
        .eq('user_id', userId)
        .order('date', { ascending: false });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return data.map(transformTrainingSession);
};

/**
 * Get a single training session by ID
 */
export const getTrainingSessionById = async (id: string): Promise<TrainingSession> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('training_sessions')
        .select(`
            *,
            profiles:user_id (
                name
            )
        `)
        .eq('id', id)
        .single();

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return transformTrainingSession(data);
};

/**
 * Create a new training session
 */
export const createTrainingSession = async (
    input: CreateTrainingSessionInput
): Promise<TrainingSession> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const insertData: TrainingSessionInsert = {
        user_id: input.userId,
        date: input.date,
        time_slot: input.timeSlot,
        exercise_content: input.exerciseContent || null,
        calendar_event_id: input.calendarEventId || null,
    };

    const { data, error } = await supabase
        .from('training_sessions')
        .insert(insertData)
        .select(`
            *,
            profiles:user_id (
                name
            )
        `)
        .single();

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return transformTrainingSession(data);
};

/**
 * Update a training session
 */
export const updateTrainingSession = async (
    id: string,
    updates: UpdateTrainingSessionInput
): Promise<TrainingSession> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const updateData: TrainingSessionUpdate = {};

    if (updates.exerciseContent !== undefined) {
        updateData.exercise_content = updates.exerciseContent;
    }
    if (updates.trainerConfirmed !== undefined) {
        updateData.trainer_confirmed = updates.trainerConfirmed;
    }
    if (updates.traineeConfirmed !== undefined) {
        updateData.trainee_confirmed = updates.traineeConfirmed;
    }

    const { data, error } = await supabase
        .from('training_sessions')
        .update(updateData)
        .eq('id', id)
        .select(`
            *,
            profiles:user_id (
                name
            )
        `)
        .single();

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return transformTrainingSession(data);
};

/**
 * Delete a training session
 */
export const deleteTrainingSession = async (id: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { error } = await supabase
        .from('training_sessions')
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error(handleSupabaseError(error));
    }
};

/**
 * Get user's monthly training statistics
 */
export const getUserMonthlyStats = async (
    userId: string,
    year: number,
    month: number
): Promise<MonthlyStats> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    // Get monthly count using RPC function
    const { data: monthlyData, error: monthlyError } = await supabase
        .rpc('get_user_monthly_training_count', {
            p_user_id: userId,
            p_year: year,
            p_month: month,
        });

    if (monthlyError) {
        throw new Error(handleSupabaseError(monthlyError));
    }

    // Get total count using RPC function
    const { data: totalData, error: totalError } = await supabase
        .rpc('get_user_total_training_count', {
            p_user_id: userId,
        });

    if (totalError) {
        throw new Error(handleSupabaseError(totalError));
    }

    return {
        monthlyCount: monthlyData || 0,
        totalCount: totalData || 0,
    };
};

// ============================================
// LOCKER ASSIGNMENTS API
// ============================================

/**
 * Get all locker assignments
 */
export const getLockerAssignments = async (): Promise<LockerAssignment[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('locker_assignments')
        .select(`
            *,
            profiles:user_id (
                name
            )
        `)
        .order('locker_number', { ascending: true });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return data.map(transformLockerAssignment);
};

/**
 * Get locker assignment by locker number
 */
export const getLockerAssignmentByNumber = async (
    lockerNumber: number
): Promise<LockerAssignment | null> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('locker_assignments')
        .select(`
            *,
            profiles:user_id (
                name
            )
        `)
        .eq('locker_number', lockerNumber)
        .maybeSingle();

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return data ? transformLockerAssignment(data) : null;
};

/**
 * Get locker assignment by user
 */
export const getLockerAssignmentByUser = async (
    userId: string
): Promise<LockerAssignment | null> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('locker_assignments')
        .select(`
            *,
            profiles:user_id (
                name
            )
        `)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return data ? transformLockerAssignment(data) : null;
};

/**
 * Create a locker assignment
 */
export const createLockerAssignment = async (
    input: CreateLockerAssignmentInput
): Promise<LockerAssignment> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const insertData: LockerAssignmentInsert = {
        locker_number: input.lockerNumber,
        user_id: input.userId,
    };

    const { data, error } = await supabase
        .from('locker_assignments')
        .insert(insertData)
        .select(`
            *,
            profiles:user_id (
                name
            )
        `)
        .single();

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return transformLockerAssignment(data);
};

/**
 * Delete a locker assignment
 */
export const deleteLockerAssignment = async (lockerNumber: number): Promise<void> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { error } = await supabase
        .from('locker_assignments')
        .delete()
        .eq('locker_number', lockerNumber);

    if (error) {
        throw new Error(handleSupabaseError(error));
    }
};

/**
 * Get available locker numbers
 */
export const getAvailableLockers = async (): Promise<number[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .rpc('get_available_lockers');

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return (data || []).map((row: any) => row.locker_number);
};

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================

/**
 * Subscribe to training session changes
 */
export const subscribeToTrainingSessions = (
    callback: (session: TrainingSession) => void
) => {
    if (!isSupabaseConfigured()) {
        console.warn('Supabase not configured, realtime disabled');
        return () => { };
    }

    const channel = supabase
        .channel('training_sessions_changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'training_sessions',
            },
            async (payload) => {
                if (payload.new) {
                    // Fetch the full session with joined data
                    const session = await getTrainingSessionById((payload.new as any).id);
                    callback(session);
                }
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};

/**
 * Subscribe to locker assignment changes
 */
export const subscribeToLockerAssignments = (
    callback: (assignment: LockerAssignment) => void
) => {
    if (!isSupabaseConfigured()) {
        console.warn('Supabase not configured, realtime disabled');
        return () => { };
    }

    const channel = supabase
        .channel('locker_assignments_changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'locker_assignments',
            },
            async (payload) => {
                if (payload.new) {
                    // Fetch the full assignment with joined data
                    const assignment = await getLockerAssignmentByNumber(
                        (payload.new as any).locker_number
                    );
                    if (assignment) {
                        callback(assignment);
                    }
                }
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};
