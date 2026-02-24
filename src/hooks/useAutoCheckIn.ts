/**
 * useAutoCheckIn — Automatic attendance check-in based on GPS location.
 *
 * On app load (when user is authenticated):
 * 1. Check if user already checked in today
 * 2. If not, get GPS position
 * 3. If within 200m of office → auto check-in as AT_WORK
 * 4. If GPS mismatch → show AutoCheckInDialog for manual selection
 * 5. If TRAINING event in calendar at current time → auto set TRAINING status
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import { isSupabaseConfigured } from '@/lib/supabase';
import * as attendanceService from '@/services/attendanceService';
import { toast } from 'sonner';

// Office coordinates (Paulus.pro office)
const OFFICE_LAT = 37.51439957906593;
const OFFICE_LNG = 127.02599429742935;
const OFFICE_RADIUS_METERS = 200;

/**
 * Haversine formula — distance between two lat/lng points in meters
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function useAutoCheckIn() {
  const { currentUser, events, setShowAutoCheckInDialog, setUserWorkStatus } = useAppStore();
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (!currentUser || hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    const runAutoCheckIn = async () => {
      try {
        // 1. Check if already checked in today
        if (isSupabaseConfigured()) {
          const today = await attendanceService.getTodayAttendance();
          if (today?.check_in_at) {
            console.log('[AutoCheckIn] Already checked in today, skipping');
            return;
          }
        }

        // 2. Check if current time has a TRAINING (R_TRAINING) event
        const now = new Date();
        const trainingEvent = events.find(e => {
          if (e.type !== 'R_TRAINING') return false;
          const start = new Date(e.startAt);
          const end = new Date(e.endAt);
          return now >= start && now <= end;
        });

        if (trainingEvent) {
          console.log('[AutoCheckIn] Training event detected, setting TRAINING status');
          setUserWorkStatus('TRAINING', true);
          if (isSupabaseConfigured()) {
            try {
              await attendanceService.checkIn({ type: 'office', note: 'Renatus Training (auto)' });
            } catch (e) {
              console.warn('[AutoCheckIn] Failed to record training check-in:', e);
            }
          }
          toast.success('Renatus 트레이닝 자동 출근 처리되었습니다');
          return;
        }

        // 3. Get GPS position
        if (!navigator.geolocation) {
          console.log('[AutoCheckIn] Geolocation not supported, showing dialog');
          setShowAutoCheckInDialog(true);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            const distance = haversineDistance(latitude, longitude, OFFICE_LAT, OFFICE_LNG);

            console.log(`[AutoCheckIn] Distance to office: ${Math.round(distance)}m`);

            if (distance <= OFFICE_RADIUS_METERS) {
              // Within office range → auto check-in (skip GPS re-check, already verified)
              setUserWorkStatus('AT_WORK', true);
              if (isSupabaseConfigured()) {
                try {
                  await attendanceService.checkIn({
                    type: 'office',
                    latitude,
                    longitude,
                    note: 'Auto check-in (GPS)',
                  });
                } catch (e) {
                  console.warn('[AutoCheckIn] Failed to record check-in:', e);
                }
              }
              toast.success('사무실 자동 출근 처리되었습니다');
            } else {
              // Outside office range → show dialog for manual selection
              useAppStore.setState({ autoCheckInPosition: { latitude, longitude } });
              setShowAutoCheckInDialog(true);
            }
          },
          (error) => {
            console.warn('[AutoCheckIn] GPS error:', error.message);
            // GPS failed → show dialog for manual selection
            setShowAutoCheckInDialog(true);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000,
          }
        );
      } catch (err) {
        console.error('[AutoCheckIn] Error:', err);
      }
    };

    // Delay slightly to let the app initialize
    const timer = setTimeout(runAutoCheckIn, 2000);
    return () => clearTimeout(timer);
  }, [currentUser?.id]);
}
