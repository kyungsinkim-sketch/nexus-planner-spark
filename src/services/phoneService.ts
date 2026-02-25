/**
 * Phone Service — Contact access, call initiation, auto-recording pipeline.
 *
 * Mobile (Tauri): Uses native bridge for contacts + calls
 * Web: Uses browser MediaRecorder for manual recording (no call feature)
 *
 * Pipeline: Call → Auto-Record → Upload → STT → Brain → RAG Ingest
 */

import { invoke } from '@tauri-apps/api/core';
import type { RecordingType } from '@/types/core';

// ─── Types ───────────────────────────────────────────

export interface PhoneContact {
  id: string;
  name: string;
  phoneNumbers: string[];
  email?: string;
  company?: string;
  thumbnail?: string;
}

export type CallState = 'idle' | 'dialing' | 'active' | 'ended';

export interface CallRecord {
  phoneNumber: string;
  contactName?: string;
  state: CallState;
  startedAt?: string;
  endedAt?: string;
  durationSeconds: number;
  recordingPath?: string;
}

// ─── Platform Detection ──────────────────────────────

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isPhoneCallSupported(): boolean {
  return isTauri() && isMobile();
}

// ─── Contacts ────────────────────────────────────────

export async function getContacts(): Promise<PhoneContact[]> {
  if (!isTauri()) {
    return [];
  }

  try {
    const contacts = await invoke<PhoneContact[]>('phone_get_contacts');
    return contacts;
  } catch (err) {
    console.warn('[Phone] Contact access failed:', err);
    // Fallback: try web Contacts API (Chrome Android only)
    return tryWebContactsApi();
  }
}

export async function searchContacts(query: string): Promise<PhoneContact[]> {
  if (!query.trim()) return [];

  if (isTauri()) {
    try {
      return await invoke<PhoneContact[]>('phone_search_contacts', { query });
    } catch {
      // Fallback to client-side filter
      const all = await getContacts();
      const q = query.toLowerCase();
      return all.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phoneNumbers.some(p => p.includes(q))
      );
    }
  }

  return [];
}

// Web Contacts API fallback (Chrome Android 80+)
async function tryWebContactsApi(): Promise<PhoneContact[]> {
  if (!('contacts' in navigator && 'ContactsManager' in window)) {
    return [];
  }

  try {
    const props = ['name', 'tel', 'email'];
    // @ts-expect-error - Contacts API not yet in TypeScript lib
    const contacts = await navigator.contacts.select(props, { multiple: true });
    return contacts.map((c: Record<string, string[]>, i: number) => ({
      id: `web-${i}`,
      name: c.name?.[0] || 'Unknown',
      phoneNumbers: c.tel || [],
      email: c.email?.[0],
    }));
  } catch {
    return [];
  }
}

// ─── Phone Calls ─────────────────────────────────────

export async function makeCall(phoneNumber: string, contactName?: string): Promise<CallRecord> {
  if (isTauri()) {
    try {
      return await invoke<CallRecord>('phone_make_call', { phoneNumber, contactName });
    } catch {
      // Fallback: open tel: link (system dialer)
      window.open(`tel:${phoneNumber}`, '_self');
      return {
        phoneNumber,
        contactName,
        state: 'dialing',
        durationSeconds: 0,
      };
    }
  }

  // Web fallback: open tel: link
  window.open(`tel:${phoneNumber}`, '_self');
  return {
    phoneNumber,
    contactName,
    state: 'dialing',
    durationSeconds: 0,
  };
}

export async function getCallState(): Promise<CallState> {
  if (isTauri()) {
    try {
      return await invoke<CallState>('phone_get_call_state');
    } catch {
      return 'idle';
    }
  }
  return 'idle';
}

export async function stopCallRecording(): Promise<string | null> {
  if (isTauri()) {
    try {
      return await invoke<string | null>('phone_stop_recording');
    } catch {
      return null;
    }
  }
  return null;
}

// ─── Recording Type Helper ───────────────────────────

export function getRecordingTypeForCall(): RecordingType {
  return 'phone_call';
}
