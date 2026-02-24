/**
 * Retry utility for transient network errors.
 *
 * - Exponential backoff with jitter
 * - Only retries on transient failures (network, 5xx, timeout)
 * - Skips retry for auth/validation errors (4xx)
 * - Configurable max retries and base delay
 */

export interface RetryOptions {
  /** Max number of retry attempts (default: 2 → total 3 tries) */
  maxRetries?: number;
  /** Base delay in ms before first retry (default: 800) */
  baseDelay?: number;
  /** Maximum delay cap in ms (default: 5000) */
  maxDelay?: number;
  /** Label for log messages (default: 'query') */
  label?: string;
  /** Whether to log retry attempts (default: true) */
  silent?: boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 2,
  baseDelay: 800,
  maxDelay: 5000,
  label: 'query',
  silent: false,
};

/**
 * Determine if an error is transient and worth retrying.
 * Returns false for auth/permission/validation errors.
 */
function isTransient(error: unknown): boolean {
  if (!error) return false;

  const msg = (
    typeof error === 'object' && error !== null && 'message' in error
      ? (error as { message?: string }).message
      : String(error)
  )?.toLowerCase() ?? '';

  // Supabase / PostgREST error codes that are NOT transient
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code?: string }).code
      : undefined;

  // Auth & validation errors — do NOT retry
  if (code === 'PGRST301') return false; // JWT expired
  if (code === '42501') return false;     // insufficient privilege
  if (code === '23505') return false;     // unique violation
  if (code === '23503') return false;     // foreign key violation
  if (code === '22P02') return false;     // invalid text representation
  if (code === 'PGRST116') return false;  // not found (single row expected)
  if (msg.includes('jwt expired')) return false;
  if (msg.includes('invalid input syntax')) return false;
  if (msg.includes('duplicate key')) return false;
  if (msg.includes('violates foreign key')) return false;
  if (msg.includes('permission denied')) return false;
  if (msg.includes('row-level security')) return false;

  // Network / transient signals — DO retry
  if (msg.includes('fetch') || msg.includes('network')) return true;
  if (msg.includes('timeout') || msg.includes('timed out')) return true;
  if (msg.includes('econnreset') || msg.includes('econnrefused')) return true;
  if (msg.includes('socket hang up')) return true;
  if (msg.includes('aborted')) return true;
  if (msg.includes('502') || msg.includes('503') || msg.includes('504')) return true;
  if (msg.includes('bad gateway') || msg.includes('service unavailable')) return true;
  if (msg.includes('gateway timeout')) return true;
  if (msg.includes('connection') && msg.includes('refused')) return true;

  // Supabase Realtime / channel errors
  if (msg.includes('channel') && msg.includes('error')) return true;

  // Default: treat unknown errors as NOT transient (don't blindly retry)
  return false;
}

/** Sleep with jitter: delay * (0.5 – 1.5) */
function sleepWithJitter(delay: number): Promise<void> {
  const jittered = delay * (0.5 + Math.random());
  return new Promise((resolve) => setTimeout(resolve, jittered));
}

/**
 * Execute an async function with automatic retry on transient errors.
 *
 * @example
 * const data = await withRetry(
 *   () => supabase.from('projects').select('*'),
 *   { label: 'loadProjects', maxRetries: 2 }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry non-transient errors
      if (!isTransient(error)) {
        throw error;
      }

      // Don't retry after last attempt
      if (attempt >= opts.maxRetries) {
        break;
      }

      const delay = Math.min(opts.baseDelay * 2 ** attempt, opts.maxDelay);

      if (!opts.silent) {
        console.warn(
          `[retry:${opts.label}] Attempt ${attempt + 1}/${opts.maxRetries + 1} failed (transient). ` +
          `Retrying in ${Math.round(delay)}ms...`,
          typeof lastError === 'object' && lastError !== null && 'message' in lastError
            ? (lastError as { message: string }).message
            : lastError,
        );
      }

      await sleepWithJitter(delay);
    }
  }

  throw lastError;
}

/**
 * Wrapper for Supabase queries that returns { data, error }.
 * Retries transient network errors; non-transient errors pass through normally.
 *
 * @example
 * const { data, error } = await withSupabaseRetry(
 *   () => supabase.from('projects').select('*'),
 *   { label: 'loadProjects' }
 * );
 */
export async function withSupabaseRetry<T>(
  fn: () => Promise<{ data: T; error: { message?: string; code?: string } | null }>,
  options?: RetryOptions,
): Promise<{ data: T; error: { message?: string; code?: string } | null }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastResult: { data: T; error: { message?: string; code?: string } | null } | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const result = await fn();
      lastResult = result;

      // No error → return immediately
      if (!result.error) {
        return result;
      }

      // Non-transient Supabase error → return immediately (caller handles it)
      if (!isTransient(result.error)) {
        return result;
      }

      // Transient error → retry
      if (attempt >= opts.maxRetries) {
        break;
      }

      const delay = Math.min(opts.baseDelay * 2 ** attempt, opts.maxDelay);

      if (!opts.silent) {
        console.warn(
          `[retry:${opts.label}] Attempt ${attempt + 1}/${opts.maxRetries + 1} failed (transient). ` +
          `Retrying in ${Math.round(delay)}ms...`,
          result.error?.message,
        );
      }

      await sleepWithJitter(delay);
    } catch (error) {
      // Network-level error (fetch failed entirely)
      if (!isTransient(error) || attempt >= opts.maxRetries) {
        throw error;
      }

      const delay = Math.min(opts.baseDelay * 2 ** attempt, opts.maxDelay);

      if (!opts.silent) {
        console.warn(
          `[retry:${opts.label}] Attempt ${attempt + 1}/${opts.maxRetries + 1} threw (transient). ` +
          `Retrying in ${Math.round(delay)}ms...`,
        );
      }

      await sleepWithJitter(delay);
    }
  }

  // Return last result if we have one, otherwise throw
  if (lastResult) return lastResult;
  throw new Error(`[retry:${opts.label}] All ${opts.maxRetries + 1} attempts failed`);
}
