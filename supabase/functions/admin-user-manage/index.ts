/**
 * admin-user-manage — Admin user management Edge Function.
 *
 * Handles admin-only operations that require service_role access:
 *   - createUser: Create a new user with email/password
 *   - updateRole: Update a user's role
 *   - deleteUser: Delete a user
 *   - resetPassword: Reset a user's password
 *
 * All actions require ADMIN role (verified via JWT + profiles table).
 * The service_role key is ONLY used server-side, never exposed to the client.
 *
 * Request body: { action: string, ...params }
 */

import { authenticateAdmin } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authenticate — MUST be admin
    const { supabase } = await authenticateAdmin(req);

    const body = await req.json();
    const { action } = body;

    // We need the service role key for Supabase Auth Admin API
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    switch (action) {
      // ─── Create User ────────────────────────────────
      case 'createUser': {
        const { email, name, role } = body;

        if (!email || !name) {
          return jsonResponse({ error: 'Missing email or name' }, 400);
        }

        // Create user via Supabase Auth Admin API
        const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password: 'newstart',
            email_confirm: true,
            user_metadata: { name },
          }),
        });

        if (!response.ok) {
          let errMsg = 'Failed to create user';
          try {
            const err = await response.json();
            errMsg = err.msg || err.message || err.error_description || errMsg;
          } catch {
            errMsg = `Auth API returned ${response.status}: ${await response.text().catch(() => 'unknown')}`;
          }
          console.error('[admin-user-manage] createUser error:', errMsg);
          return jsonResponse({ error: errMsg }, response.status);
        }

        const userData = await response.json();

        // Set role in profiles table if not MEMBER (default)
        if (role && role !== 'MEMBER') {
          await supabase
            .from('profiles')
            .update({ role })
            .eq('id', userData.id);
        }

        return jsonResponse({
          success: true,
          userId: userData.id,
          message: `User ${name} created successfully`,
        });
      }

      // ─── Update Role ────────────────────────────────
      case 'updateRole': {
        const { targetUserId, newRole } = body;

        if (!targetUserId || !newRole) {
          return jsonResponse({ error: 'Missing targetUserId or newRole' }, 400);
        }

        const validRoles = ['ADMIN', 'MANAGER', 'PRODUCER', 'TRAINER', 'MEMBER'];
        if (!validRoles.includes(newRole)) {
          return jsonResponse({ error: `Invalid role: ${newRole}` }, 400);
        }

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role: newRole })
          .eq('id', targetUserId);

        if (updateError) {
          return jsonResponse({ error: updateError.message }, 500);
        }

        return jsonResponse({ success: true, message: 'Role updated' });
      }

      // ─── Delete User ────────────────────────────────
      case 'deleteUser': {
        const { targetUserId } = body;

        if (!targetUserId) {
          return jsonResponse({ error: 'Missing targetUserId' }, 400);
        }

        const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${targetUserId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
          },
        });

        if (!response.ok) {
          const err = await response.json();
          return jsonResponse({ error: err.msg || err.message || 'Failed to delete user' }, response.status);
        }

        return jsonResponse({ success: true, message: 'User deleted' });
      }

      // ─── Reset Password ─────────────────────────────
      case 'resetPassword': {
        const { targetUserId, newPassword } = body;

        if (!targetUserId || !newPassword) {
          return jsonResponse({ error: 'Missing targetUserId or newPassword' }, 400);
        }

        if (newPassword.length < 6) {
          return jsonResponse({ error: 'Password must be at least 6 characters' }, 400);
        }

        // Use Supabase Auth Admin API to update password
        const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${targetUserId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ password: newPassword }),
        });

        if (!response.ok) {
          const err = await response.json();
          return jsonResponse({ error: err.msg || err.message || 'Failed to reset password' }, response.status);
        }

        return jsonResponse({ success: true, message: 'Password updated' });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    // If err is a Response (from authenticateAdmin), return it directly
    if (err instanceof Response) {
      return err;
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[admin-user-manage] Unhandled error:', errMsg, err);
    return jsonResponse({ error: errMsg || 'Internal server error' }, 500);
  }
});
