/**
 * Shared JWT authentication helper for Edge Functions.
 *
 * Extracts and verifies the user from the Authorization header JWT token.
 * This prevents userId spoofing — the userId always comes from the
 * verified JWT, never from the request body.
 *
 * Two modes:
 *   1. authenticateRequest()  — strict JWT auth (for frontend-called functions)
 *   2. authenticateOrFallback() — try JWT first, fall back for server-to-server calls
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export interface AuthResult {
  user: { id: string; email?: string; role?: string };
  supabase: SupabaseClient;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Create a service-role Supabase client (no auth verification).
 * Use only for server-to-server Edge Function calls (cron, internal).
 */
export function createServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

/**
 * Authenticate a request using the JWT from Authorization header.
 * Returns the verified user and a service-role Supabase client.
 *
 * @throws Response with 401 if authentication fails
 */
export async function authenticateRequest(req: Request): Promise<AuthResult> {
  const supabase = createServiceClient();

  // Extract JWT from Authorization header
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    throw new Response(
      JSON.stringify({ error: 'Missing authorization token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Verify the JWT and get the user
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Response(
      JSON.stringify({ error: 'Invalid or expired token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    supabase,
  };
}

/**
 * Try JWT auth first. If no token present, return null (server-to-server call).
 * This allows Edge Functions triggered by cron/internal calls to still work.
 */
export async function authenticateOrFallback(
  req: Request,
): Promise<{ userId: string | null; supabase: SupabaseClient }> {
  const supabase = createServiceClient();

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  if (token) {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) {
      return { userId: user.id, supabase };
    }
    // Token present but invalid — reject
    throw new Response(
      JSON.stringify({ error: 'Invalid or expired token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // No token — allow server-to-server calls
  return { userId: null, supabase };
}

/**
 * Authenticate and verify the user has ADMIN role.
 * Checks the profiles table for the role.
 */
export async function authenticateAdmin(req: Request): Promise<AuthResult> {
  const auth = await authenticateRequest(req);

  // Check admin role from profiles table
  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .single();

  if (!profile || profile.role !== 'ADMIN') {
    throw new Response(
      JSON.stringify({ error: 'Admin access required' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  return auth;
}
