/**
 * Gmail Service — Frontend integration for Gmail API via Edge Functions.
 *
 * Handles:
 * - Incremental email fetching (new emails only via historyId)
 * - Brain AI analysis of emails (intent, events, todos, notes, date validation)
 * - Reply sending via Edge Function
 *
 * Mock mode: returns mock data directly without Edge Function calls.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { GmailMessage, EmailBrainSuggestion } from '@/types/core';
import { mockGmailMessages, mockEmailSuggestions } from '@/mock/data';

// ─── Mock Mode Detection ────────────────────────────

function isMockMode(): boolean {
  return !isSupabaseConfigured();
}

// ─── Fetch New Emails (Incremental) ─────────────────

export async function fetchNewEmails(
  userId: string,
): Promise<{ messages: GmailMessage[]; historyId?: string }> {
  if (isMockMode()) {
    // Return mock data in development
    return { messages: mockGmailMessages };
  }

  try {
    const { data, error } = await supabase.functions.invoke('gmail-fetch', {
      body: { userId },
    });

    if (error) {
      console.error('[Gmail] Fetch error:', error);
      return { messages: [] };
    }

    if (data?.error) {
      console.error('[Gmail] Fetch error:', data.error);
      return { messages: [] };
    }

    return {
      messages: data?.newMessages || [],
      historyId: data?.historyId,
    };
  } catch (err) {
    console.error('[Gmail] Fetch exception:', err);
    return { messages: [] };
  }
}

// ─── Analyze Emails with Brain AI ───────────────────

export async function analyzeWithBrain(
  userId: string,
  messages: GmailMessage[],
): Promise<EmailBrainSuggestion[]> {
  if (isMockMode()) {
    // Return mock suggestions for development
    return mockEmailSuggestions;
  }

  if (messages.length === 0) return [];

  try {
    const { data, error } = await supabase.functions.invoke('gmail-brain-analyze', {
      body: { userId, messages },
    });

    if (error) {
      console.error('[Gmail] Brain analysis error:', error);
      return [];
    }

    if (data?.error) {
      console.error('[Gmail] Brain analysis error:', data.error);
      return [];
    }

    return data?.suggestions || [];
  } catch (err) {
    console.error('[Gmail] Brain analysis exception:', err);
    return [];
  }
}

// ─── Send Reply ─────────────────────────────────────

export async function sendReply(
  userId: string,
  params: {
    threadId: string;
    messageId: string;
    body: string;
    to: string;
    subject: string;
  },
): Promise<{ success: boolean; error?: string }> {
  if (isMockMode()) {
    // Simulate success in mock mode
    console.log('[Gmail Mock] Reply sent:', params);
    return { success: true };
  }

  try {
    const { data, error } = await supabase.functions.invoke('gmail-send-reply', {
      body: { userId, ...params },
    });

    if (error) {
      console.error('[Gmail] Send reply error:', error);
      return { success: false, error: error.message };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return { success: true };
  } catch (err) {
    console.error('[Gmail] Send reply exception:', err);
    return { success: false, error: (err as Error).message };
  }
}
