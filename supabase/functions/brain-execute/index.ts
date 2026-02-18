// Brain Execute Edge Function
// Executes a confirmed brain action (create todo, create event, share location).
//
// Flow:
//   1. Client sends { actionId, userId } after user confirms
//   2. Edge Function reads the brain_action row
//   3. Executes the action (inserts into todos, calendar_events, etc.)
//   4. Updates brain_action status to 'executed'
//   5. Returns the created entity

import { createClient } from 'jsr:@supabase/supabase-js@2';
import type { ExecuteRequest } from '../_shared/brain-types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: ExecuteRequest = await req.json();
    const { actionId, userId } = body;

    if (!actionId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: actionId, userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Create Supabase service client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Read the brain_action
    const { data: action, error: fetchError } = await supabase
      .from('brain_actions')
      .select('*')
      .eq('id', actionId)
      .single();

    if (fetchError || !action) {
      return new Response(
        JSON.stringify({ error: 'Brain action not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (action.status !== 'pending' && action.status !== 'confirmed') {
      return new Response(
        JSON.stringify({ error: `Action already processed (status: ${action.status})` }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const extractedData = action.extracted_data as Record<string, unknown>;
    let executedData: Record<string, unknown> = {};

    // 2. Execute based on action_type
    switch (action.action_type) {
      case 'create_todo': {
        const todoData = extractedData;
        const assigneeIds = (todoData.assigneeIds as string[]) || [];

        // Insert into personal_todos table
        const { data: todo, error: todoError } = await supabase
          .from('personal_todos')
          .insert({
            title: todoData.title,
            assignee_ids: assigneeIds.filter((id: string) => id !== ''),
            requested_by_id: userId,
            project_id: todoData.projectId || null,
            due_date: todoData.dueDate,
            priority: todoData.priority || 'NORMAL',
            status: 'PENDING',
          })
          .select()
          .single();

        if (todoError) {
          throw new Error(`Failed to create todo: ${todoError.message}`);
        }

        executedData = { todoId: todo.id, type: 'todo', ...todo };

        // Also create calendar events for each assignee (auto-sync)
        // Use KST timezone to ensure single-day events stay on the correct date
        const dueDateStr = todoData.dueDate as string;
        const todoStartAt = dueDateStr ? `${dueDateStr.substring(0, 10)}T00:00:00+09:00` : null;
        const todoEndAt = dueDateStr ? `${dueDateStr.substring(0, 10)}T23:59:59+09:00` : null;

        for (const assigneeId of assigneeIds.filter((id: string) => id !== '')) {
          await supabase.from('calendar_events').insert({
            title: `[Todo] ${todoData.title}`,
            type: 'TODO',
            start_at: todoStartAt,
            end_at: todoEndAt,
            project_id: todoData.projectId || null,
            owner_id: assigneeId,
            due_date: todoData.dueDate,
            source: 'PAULUS',
            todo_id: todo.id,
          });
        }

        break;
      }

      case 'create_event': {
        const eventData = extractedData;
        const attendeeIds = (eventData.attendeeIds as string[]) || [];

        // Normalize date strings — if bare date (YYYY-MM-DD), add KST timezone
        // to prevent UTC conversion from shifting to a different date
        const normalizeToKST = (dt: unknown): string | null => {
          if (!dt || typeof dt !== 'string') return null;
          // If it's already a full ISO datetime or has timezone, keep as-is
          if (dt.includes('T') && dt.length > 11) return dt;
          // Bare date string (YYYY-MM-DD) → add time with KST offset
          return `${dt.substring(0, 10)}T00:00:00+09:00`;
        };

        let eventStartAt = normalizeToKST(eventData.startAt);
        let eventEndAt = normalizeToKST(eventData.endAt);

        // If start and end are the same day (both are bare dates), make end = 23:59:59
        if (eventStartAt && eventEndAt &&
            eventStartAt.substring(0, 10) === eventEndAt.substring(0, 10) &&
            eventStartAt.includes('T00:00:00')) {
          eventEndAt = `${eventEndAt.substring(0, 10)}T23:59:59+09:00`;
        }

        // Build the event insert object
        const filteredAttendeeIds = attendeeIds.filter((id: string) => id !== '');
        const eventInsert: Record<string, unknown> = {
          title: eventData.title,
          type: eventData.type || 'MEETING',
          start_at: eventStartAt,
          end_at: eventEndAt,
          project_id: eventData.projectId || null,
          owner_id: userId,
          source: 'PAULUS',
          attendee_ids: filteredAttendeeIds.length > 0 ? filteredAttendeeIds : null,
        };

        // Include location data if available
        if (eventData.location) {
          eventInsert.location = eventData.location;
        }
        if (eventData.locationUrl) {
          eventInsert.location_url = eventData.locationUrl;
        }

        // Insert the event
        const { data: event, error: eventError } = await supabase
          .from('calendar_events')
          .insert(eventInsert)
          .select()
          .single();

        if (eventError) {
          throw new Error(`Failed to create event: ${eventError.message}`);
        }

        // Insert attendees into calendar_event_attendees
        if (attendeeIds.length > 0) {
          const attendeeInserts = attendeeIds
            .filter((id: string) => id !== '')
            .map((attendeeId: string) => ({
              event_id: event.id,
              user_id: attendeeId,
            }));

          if (attendeeInserts.length > 0) {
            await supabase
              .from('calendar_event_attendees')
              .insert(attendeeInserts);
          }
        }

        executedData = { eventId: event.id, type: 'event', ...event };
        break;
      }

      case 'update_event': {
        // Find the existing event by originalTitle and update it
        const updateData = extractedData;
        const originalTitle = (updateData.originalTitle as string) || '';

        if (!originalTitle) {
          throw new Error('update_event requires originalTitle to find the event');
        }

        // Search for the event by title (owner's events, most recent first)
        const { data: matchingEvents, error: searchError } = await supabase
          .from('calendar_events')
          .select('*')
          .ilike('title', `%${originalTitle}%`)
          .eq('owner_id', userId)
          .order('created_at', { ascending: false })
          .limit(5);

        if (searchError) {
          throw new Error(`Failed to search events: ${searchError.message}`);
        }

        // Find the best match — prefer exact title match, then most recent
        let targetEvent = matchingEvents?.find(
          (e: Record<string, unknown>) => (e.title as string) === originalTitle,
        );
        if (!targetEvent && matchingEvents && matchingEvents.length > 0) {
          targetEvent = matchingEvents[0]; // Most recent partial match
        }

        if (!targetEvent) {
          // Also try searching ALL events (not just owned) since RLS is relaxed
          const { data: allEvents } = await supabase
            .from('calendar_events')
            .select('*')
            .ilike('title', `%${originalTitle}%`)
            .order('created_at', { ascending: false })
            .limit(5);

          if (allEvents && allEvents.length > 0) {
            targetEvent = allEvents.find(
              (e: Record<string, unknown>) => (e.title as string) === originalTitle,
            ) || allEvents[0];
          }
        }

        if (!targetEvent) {
          throw new Error(`Event not found with title: "${originalTitle}"`);
        }

        // Build update object — only include fields that are provided
        const eventUpdates: Record<string, unknown> = {};
        if (updateData.title) eventUpdates.title = updateData.title;
        if (updateData.startAt) eventUpdates.start_at = updateData.startAt;
        if (updateData.endAt) eventUpdates.end_at = updateData.endAt;
        if (updateData.location !== undefined) eventUpdates.location = updateData.location;
        if (updateData.type) eventUpdates.type = updateData.type;
        if (updateData.attendeeIds) {
          const filteredIds = (updateData.attendeeIds as string[]).filter((id: string) => id !== '');
          if (filteredIds.length > 0) eventUpdates.attendee_ids = filteredIds;
        }

        // If only startAt changed but endAt not specified, keep same duration
        if (updateData.startAt && !updateData.endAt) {
          const origStart = new Date(targetEvent.start_at as string).getTime();
          const origEnd = new Date(targetEvent.end_at as string).getTime();
          const duration = origEnd - origStart;
          const newStart = new Date(updateData.startAt as string).getTime();
          eventUpdates.end_at = new Date(newStart + duration).toISOString();
        }

        const { data: updatedEvent, error: updateError } = await supabase
          .from('calendar_events')
          .update(eventUpdates)
          .eq('id', targetEvent.id)
          .select()
          .single();

        if (updateError) {
          throw new Error(`Failed to update event: ${updateError.message}`);
        }

        executedData = { eventId: updatedEvent.id, type: 'event', updated: true, ...updatedEvent };
        break;
      }

      case 'share_location': {
        // Location sharing doesn't create a DB entity — it's just surfaced in chat.
        // We mark it as executed and store the search URL.
        const locationData = extractedData;
        const searchQuery = encodeURIComponent(
          (locationData.searchQuery as string) || (locationData.title as string) || '',
        );
        const mapUrl = `https://www.google.com/maps/search/?api=1&query=${searchQuery}`;

        executedData = {
          type: 'location',
          title: locationData.title,
          address: locationData.address,
          mapUrl,
        };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action type: ${action.action_type}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }

    // 3. Update brain_action status
    const { error: updateError } = await supabase
      .from('brain_actions')
      .update({
        status: 'executed',
        confirmed_by: userId,
        executed_data: executedData,
        executed_at: new Date().toISOString(),
      })
      .eq('id', actionId);

    if (updateError) {
      console.error('Failed to update brain_action status:', updateError);
    }

    // 4. Return result
    return new Response(
      JSON.stringify({
        success: true,
        actionId,
        executedData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('brain-execute error:', error);

    // Try to mark action as failed
    try {
      const body = await req.clone().json().catch(() => null);
      if (body?.actionId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase
          .from('brain_actions')
          .update({ status: 'failed' })
          .eq('id', body.actionId);
      }
    } catch {
      // Ignore cleanup errors
    }

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
