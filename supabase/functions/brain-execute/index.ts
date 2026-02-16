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
        for (const assigneeId of assigneeIds.filter((id: string) => id !== '')) {
          await supabase.from('calendar_events').insert({
            title: `[Todo] ${todoData.title}`,
            type: 'TODO',
            start_at: todoData.dueDate,
            end_at: todoData.dueDate,
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

        // Build the event insert object
        const eventInsert: Record<string, unknown> = {
          title: eventData.title,
          type: eventData.type || 'MEETING',
          start_at: eventData.startAt,
          end_at: eventData.endAt,
          project_id: eventData.projectId || null,
          owner_id: userId,
          source: 'PAULUS',
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
