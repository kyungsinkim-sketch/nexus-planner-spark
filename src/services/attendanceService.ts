/**
 * Attendance Service
 * 근태관리 서비스 - GPS 좌표 포함 출퇴근 기록
 */

import { supabase, handleSupabaseError, isSupabaseConfigured } from '@/lib/supabase';
import { withSupabaseRetry } from '@/lib/retry';
import { getTranslation, type Language } from '@/lib/i18n';
import { useAppStore } from '@/stores/appStore';

/** Helper to get current language from store (non-React context) */
function getLang(): Language {
    return useAppStore.getState().language;
}

// ============================================
// Types
// ============================================
export interface AttendanceRecord {
    id: string;
    user_id: string;
    check_in_at: string | null;
    check_in_type: AttendanceType | null;
    check_in_latitude: number | null;
    check_in_longitude: number | null;
    check_in_address: string | null;
    check_in_note: string | null;
    check_out_at: string | null;
    check_out_latitude: number | null;
    check_out_longitude: number | null;
    check_out_address: string | null;
    check_out_note: string | null;
    working_minutes: number | null;
    work_date: string;
    status: 'working' | 'completed' | 'early_leave' | 'absent' | 'holiday';
    created_at: string;
    updated_at: string;
}

export type AttendanceType = 'office' | 'remote' | 'overseas' | 'filming' | 'field';

export interface AttendanceTypeInfo {
    id: AttendanceType;
    label_ko: string;
    label_en: string;
    requires_gps: boolean;
    icon: string;
    color: string;
}

export interface CheckInPayload {
    type: AttendanceType;
    latitude?: number;
    longitude?: number;
    address?: string;
    note?: string;
}

export interface CheckOutPayload {
    latitude?: number;
    longitude?: number;
    address?: string;
    note?: string;
}

export interface GeoPosition {
    latitude: number;
    longitude: number;
    accuracy: number;
    address?: string;
}

// ============================================
// Attendance Types (Fallback)
// ============================================
export const ATTENDANCE_TYPES: AttendanceTypeInfo[] = [
    { id: 'office', label_ko: '사무실 출근', label_en: 'Office', requires_gps: false, icon: 'Building2', color: 'blue' },
    { id: 'remote', label_ko: '재택근무', label_en: 'Remote Work', requires_gps: true, icon: 'Home', color: 'green' },
    { id: 'overseas', label_ko: '해외출장', label_en: 'Overseas Trip', requires_gps: true, icon: 'Plane', color: 'purple' },
    { id: 'filming', label_ko: '촬영 현장', label_en: 'Filming', requires_gps: true, icon: 'Film', color: 'orange' },
    { id: 'field', label_ko: '현장 방문', label_en: 'Field Work', requires_gps: true, icon: 'MapPin', color: 'teal' },
];

// ============================================
// Geolocation Helper
// ============================================
export async function getCurrentPosition(): Promise<GeoPosition> {
    if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser');
    }

    // Try multiple readings and pick the most accurate one
    const attempts = 3;
    let bestPosition: GeolocationPosition | null = null;

    for (let i = 0; i < attempts; i++) {
        try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0,
                });
            });

            if (!bestPosition || pos.coords.accuracy < bestPosition.coords.accuracy) {
                bestPosition = pos;
            }

            // Good enough — stop early
            if (pos.coords.accuracy <= 20) break;

            // Brief wait before retry for GPS to warm up
            if (i < attempts - 1) {
                await new Promise(r => setTimeout(r, 800));
            }
        } catch (error: any) {
            // If permission denied, fail immediately
            if (error?.code === 1) {
                throw new Error(getTranslation(getLang(), 'locationPermissionDenied'));
            }
            // On last attempt, throw
            if (i === attempts - 1 && !bestPosition) {
                let message = 'Failed to get location';
                switch (error?.code) {
                    case 2: message = getTranslation(getLang(), 'locationUnavailable'); break;
                    case 3: message = getTranslation(getLang(), 'locationTimeout'); break;
                }
                throw new Error(message);
            }
        }
    }

    if (!bestPosition) {
        throw new Error('Failed to get location');
    }

    const { latitude, longitude, accuracy } = bestPosition.coords;
    console.log(`[GPS] Best accuracy: ${accuracy.toFixed(1)}m (after up to ${attempts} attempts)`);

    // Reverse geocode
    let address: string | undefined;
    try {
        address = await reverseGeocode(latitude, longitude);
    } catch (e) {
        console.warn('Reverse geocoding failed:', e);
    }

    return { latitude, longitude, accuracy, address };
}

// Simple reverse geocoding using Nominatim (free, no API key required)
async function reverseGeocode(lat: number, lng: number): Promise<string | undefined> {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            {
                headers: {
                    'Accept-Language': 'ko',
                },
            }
        );
        if (!response.ok) return undefined;

        const data = await response.json();
        return data.display_name || undefined;
    } catch {
        return undefined;
    }
}

// ============================================
// Service Functions
// ============================================

/**
 * Get today's attendance record for current user
 */
export async function getTodayAttendance(): Promise<AttendanceRecord | null> {
    if (!isSupabaseConfigured()) {
        console.log('[AttendanceService] Supabase not configured, returning null');
        return null;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await withSupabaseRetry(
        () => supabase
            .from('nexus_attendance')
            .select('*')
            .eq('user_id', user.id)
            .eq('work_date', today)
            .single(),
        { label: 'getTodayAttendance' },
    );

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        throw handleSupabaseError(error);
    }

    return data as AttendanceRecord | null;
}

/**
 * Check in (출근)
 */
export async function checkIn(payload: CheckInPayload): Promise<AttendanceRecord> {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase is not configured');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('nexus_attendance')
        .upsert({
            user_id: user.id,
            work_date: today,
            check_in_at: now,
            check_in_type: payload.type,
            check_in_latitude: payload.latitude,
            check_in_longitude: payload.longitude,
            check_in_address: payload.address,
            check_in_note: payload.note,
            status: 'working',
        }, {
            onConflict: 'user_id,work_date',
        })
        .select()
        .single();

    if (error) throw handleSupabaseError(error);
    return data as AttendanceRecord;
}

/**
 * Check out (퇴근)
 */
export async function checkOut(payload: CheckOutPayload): Promise<AttendanceRecord> {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase is not configured');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    // Calculate working minutes from check-in
    const { data: existing } = await supabase
        .from('nexus_attendance')
        .select('check_in_at')
        .eq('user_id', user.id)
        .eq('work_date', today)
        .single();

    let workingMinutes: number | null = null;
    if (existing?.check_in_at) {
        const checkInMs = new Date(existing.check_in_at).getTime();
        const nowMs = new Date(now).getTime();
        workingMinutes = Math.max(0, Math.round((nowMs - checkInMs) / 60000));
    }

    const { data, error } = await supabase
        .from('nexus_attendance')
        .update({
            check_out_at: now,
            check_out_latitude: payload.latitude,
            check_out_longitude: payload.longitude,
            check_out_address: payload.address,
            check_out_note: payload.note,
            working_minutes: workingMinutes,
            status: 'completed',
        })
        .eq('user_id', user.id)
        .eq('work_date', today)
        .select()
        .single();

    if (error) throw handleSupabaseError(error);
    return data as AttendanceRecord;
}

/**
 * Get attendance history for current user
 */
export async function getAttendanceHistory(
    startDate: string,
    endDate: string
): Promise<AttendanceRecord[]> {
    if (!isSupabaseConfigured()) {
        return [];
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await withSupabaseRetry(
        () => supabase
            .from('nexus_attendance')
            .select('*')
            .eq('user_id', user.id)
            .gte('work_date', startDate)
            .lte('work_date', endDate)
            .order('work_date', { ascending: false }),
        { label: 'getAttendanceHistory' },
    );

    if (error) throw handleSupabaseError(error);
    return data as AttendanceRecord[];
}

/**
 * Get monthly summary for current user
 */
export async function getMonthlyAttendanceSummary(year: number, month: number) {
    if (!isSupabaseConfigured()) {
        return null;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month

    const { data, error } = await withSupabaseRetry(
        () => supabase
            .from('nexus_attendance')
            .select('*')
            .eq('user_id', user.id)
            .gte('work_date', startDate)
            .lte('work_date', endDate),
        { label: 'getMonthlyAttendanceSummary' },
    );

    if (error) throw handleSupabaseError(error);

    const records = data as AttendanceRecord[];

    return {
        totalDays: records.length,
        completedDays: records.filter(r => r.status === 'completed').length,
        remoteDays: records.filter(r => r.check_in_type === 'remote').length,
        overseasDays: records.filter(r => r.check_in_type === 'overseas').length,
        filmingDays: records.filter(r => r.check_in_type === 'filming').length,
        totalMinutes: records.reduce((sum, r) => sum + (r.working_minutes || 0), 0),
        avgMinutesPerDay: records.length > 0
            ? Math.round(records.reduce((sum, r) => sum + (r.working_minutes || 0), 0) / records.length)
            : 0,
    };
}

/**
 * Get all team attendance for today (Admin only)
 */
export async function getTeamTodayAttendance(): Promise<AttendanceRecord[]> {
    if (!isSupabaseConfigured()) {
        return [];
    }

    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await withSupabaseRetry(
        () => supabase
            .from('nexus_attendance')
            .select(`
      *,
      profiles:user_id (
        id,
        name,
        avatar,
        department
      )
    `)
            .eq('work_date', today)
            .order('check_in_at', { ascending: true }),
        { label: 'getTeamTodayAttendance' },
    );

    if (error) throw handleSupabaseError(error);
    return data as AttendanceRecord[];
}

/**
 * Get team monthly attendance stats (Admin only)
 */
export interface TeamMonthlyStats {
  userId: string;
  name: string;
  department: string;
  workDays: number;
  totalMinutes: number;
  avgMinutesPerDay: number;
  overtimeMinutes: number;
  remoteDays: number;
  overseasDays: number;
  filmingDays: number;
  officeDays: number;
  lateCount: number;
  records: AttendanceRecord[];
}

export async function getTeamMonthlyStats(year: number, month: number): Promise<TeamMonthlyStats[]> {
  if (!isSupabaseConfigured()) return [];

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];

  const { data, error } = await withSupabaseRetry(
    () => supabase
      .from('nexus_attendance')
      .select(`*, profiles:user_id (id, name, department)`)
      .gte('work_date', startDate)
      .lte('work_date', endDate)
      .order('check_in_at', { ascending: true }),
    { label: 'getTeamMonthlyStats' },
  );

  if (error) throw handleSupabaseError(error);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records = data as any[];
  const userMap = new Map<string, TeamMonthlyStats>();
  const STANDARD_DAY_MINUTES = 480;

  for (const r of records) {
    const uid = r.user_id;
    const profile = r.profiles || { id: uid, name: 'Unknown', department: null };

    if (!userMap.has(uid)) {
      userMap.set(uid, {
        userId: uid, name: profile.name, department: profile.department || '',
        workDays: 0, totalMinutes: 0, avgMinutesPerDay: 0, overtimeMinutes: 0,
        remoteDays: 0, overseasDays: 0, filmingDays: 0, officeDays: 0,
        lateCount: 0, records: [],
      });
    }

    const stat = userMap.get(uid)!;
    stat.records.push(r);

    if (r.status === 'completed' || r.working_minutes) {
      stat.workDays += 1;
      stat.totalMinutes += r.working_minutes || 0;
      if ((r.working_minutes || 0) > STANDARD_DAY_MINUTES) {
        stat.overtimeMinutes += (r.working_minutes || 0) - STANDARD_DAY_MINUTES;
      }
    }

    switch (r.check_in_type) {
      case 'remote': stat.remoteDays += 1; break;
      case 'overseas': stat.overseasDays += 1; break;
      case 'filming': stat.filmingDays += 1; break;
      case 'office': stat.officeDays += 1; break;
    }

    if (r.check_in_at) {
      const t = new Date(r.check_in_at);
      const kstH = (t.getUTCHours() + 9) % 24;
      const kstM = t.getUTCMinutes();
      if (kstH > 9 || (kstH === 9 && kstM > 30)) stat.lateCount += 1;
    }
  }

  for (const stat of userMap.values()) {
    stat.avgMinutesPerDay = stat.workDays > 0 ? Math.round(stat.totalMinutes / stat.workDays) : 0;
  }

  return Array.from(userMap.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
}
