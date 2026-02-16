import { supabase, isSupabaseConfigured, handleSupabaseError } from '@/lib/supabase';
import type { CalendarEvent } from '@/types/core';
import type { Database } from '@/types/database';

type EventRow = Database['public']['Tables']['calendar_events']['Row'];
type EventInsert = Database['public']['Tables']['calendar_events']['Insert'];
type EventUpdate = Database['public']['Tables']['calendar_events']['Update'];

// Transform database row to app CalendarEvent type
const transformEvent = (row: EventRow): CalendarEvent => {
    return {
        id: row.id,
        title: row.title,
        type: row.type,
        startAt: row.start_at,
        endAt: row.end_at,
        projectId: row.project_id || undefined,
        ownerId: row.owner_id,
        dueDate: row.due_date || undefined,
        source: row.source,
        googleEventId: row.google_event_id || undefined,
        todoId: row.todo_id || undefined,
        deliverableId: row.deliverable_id || undefined,
        attendeeIds: row.attendee_ids || undefined,
        location: row.location || undefined,
        locationUrl: row.location_url || undefined,
    };
};

// Transform app CalendarEvent to database insert
const transformToInsert = (event: Partial<CalendarEvent>): EventInsert => {
    return {
        title: event.title!,
        type: event.type!,
        start_at: event.startAt!,
        end_at: event.endAt!,
        project_id: event.projectId || null,
        owner_id: event.ownerId!,
        due_date: event.dueDate || null,
        source: event.source || 'PAULUS',
        google_event_id: event.googleEventId || null,
        todo_id: event.todoId || null,
        deliverable_id: event.deliverableId || null,
        attendee_ids: event.attendeeIds || null,
        location: event.location || null,
        location_url: event.locationUrl || null,
    };
};

// Get all events
export const getEvents = async (): Promise<CalendarEvent[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .order('start_at', { ascending: true });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return data.map(transformEvent);
};

// Get events by date range
export const getEventsByDateRange = async (
    startDate: string,
    endDate: string
): Promise<CalendarEvent[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .gte('start_at', startDate)
        .lte('end_at', endDate)
        .order('start_at', { ascending: true });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return data.map(transformEvent);
};

// Get events by project
export const getEventsByProject = async (projectId: string): Promise<CalendarEvent[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('project_id', projectId)
        .order('start_at', { ascending: true });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return data.map(transformEvent);
};

// Get events by owner
export const getEventsByOwner = async (ownerId: string): Promise<CalendarEvent[]> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('owner_id', ownerId)
        .order('start_at', { ascending: true });

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return data.map(transformEvent);
};

// Create event
export const createEvent = async (event: Partial<CalendarEvent>): Promise<CalendarEvent> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const insertData = transformToInsert(event);

    const { data, error } = await supabase
        .from('calendar_events')
        .insert(insertData as unknown as Record<string, unknown>)
        .select()
        .single();

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    return transformEvent(data);
};

// Update event
export const updateEvent = async (
    id: string,
    updates: Partial<CalendarEvent>
): Promise<CalendarEvent> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const updateData: EventUpdate = {};

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.startAt !== undefined) updateData.start_at = updates.startAt;
    if (updates.endAt !== undefined) updateData.end_at = updates.endAt;
    if (updates.projectId !== undefined) updateData.project_id = updates.projectId;
    if (updates.ownerId !== undefined) updateData.owner_id = updates.ownerId;
    if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;
    if (updates.source !== undefined) updateData.source = updates.source;
    if (updates.googleEventId !== undefined) updateData.google_event_id = updates.googleEventId;
    if (updates.todoId !== undefined) updateData.todo_id = updates.todoId;
    if (updates.deliverableId !== undefined) updateData.deliverable_id = updates.deliverableId;
    if (updates.attendeeIds !== undefined) updateData.attendee_ids = updates.attendeeIds;
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.locationUrl !== undefined) updateData.location_url = updates.locationUrl;

    const { data, error } = await supabase
        .from('calendar_events')
        .update(updateData as unknown as Record<string, unknown>)
        .eq('id', id)
        .select();

    if (error) {
        throw new Error(handleSupabaseError(error));
    }

    if (!data || data.length === 0) {
        throw new Error('Event not found or you do not have permission to update it');
    }

    return transformEvent(data[0]);
};

// Delete event
export const deleteEvent = async (id: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
    }

    const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error(handleSupabaseError(error));
    }
};

// Subscribe to event changes (realtime)
// Accepts a callback that fires on any INSERT/UPDATE/DELETE.
// The CalendarPage simply calls loadEvents() to refresh the full list.
export const subscribeToEvents = (
    callback: (event: CalendarEvent | null, eventType: string) => void
) => {
    if (!isSupabaseConfigured()) {
        console.warn('Supabase not configured, realtime disabled');
        return () => { };
    }

    // Unique channel name per subscriber to avoid conflicts
    // (multiple components can subscribe independently)
    const channelName = `calendar_events_changes_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const channel = supabase
        .channel(channelName)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'calendar_events',
            },
            (payload) => {
                const transformed = payload.new
                    ? transformEvent(payload.new as EventRow)
                    : null;
                callback(transformed, payload.eventType);
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
};
