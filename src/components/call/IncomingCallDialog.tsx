/**
 * IncomingCallDialog — Global incoming call notification.
 *
 * Subscribes to Supabase Realtime on call_participants table.
 * When current user is added as participant → show incoming call UI.
 * User can accept (join room) or decline.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, PhoneOff, User as UserIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAppStore } from '@/stores/appStore';
import { joinCall, getCallState } from '@/services/callService';

interface IncomingCall {
  roomId: string;
  roomName: string;
  title: string;
  callerId: string;
  callerName: string;
}

export function IncomingCallDialog() {
  const currentUser = useAppStore(s => s.currentUser);
  const users = useAppStore(s => s.users);
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [joining, setJoining] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check for incoming calls
  const checkIncomingCalls = useCallback(async () => {
    if (!currentUser?.id) return;

    const currentCallState = getCallState();
    if (currentCallState.status !== 'idle') return;

    // Find rooms where current user is a non-host participant and room is waiting/active
    const { data: rooms } = await supabase
      .from('call_participants')
      .select('room_id, role, call_rooms(id, title, livekit_room_name, status, created_by)')
      .eq('user_id', currentUser.id)
      .eq('role', 'participant')
      .order('joined_at', { ascending: false })
      .limit(1);

    if (!rooms || rooms.length === 0) return;

    const participant = rooms[0];
    const room = (participant as any).call_rooms;

    if (!room || room.status === 'ended' || room.status === 'completed' || room.status === 'processing') return;

    // Don't show if we already dismissed this room
    if (incoming?.roomId === room.id) return;
    if (dismissedRoomIds.current.has(room.id)) return;

    // Check room is recent (within last 60 seconds)
    const caller = users.find(u => u.id === room.created_by);

    setIncoming({
      roomId: room.id,
      roomName: room.livekit_room_name,
      title: room.title || '음성 통화',
      callerId: room.created_by,
      callerName: caller?.name || '알 수 없음',
    });

    // Play ringtone
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/ringtone.mp3');
        audioRef.current.loop = true;
      }
      audioRef.current.play().catch(() => {});
    } catch {}
  }, [currentUser?.id, users, incoming]);

  const dismissedRoomIds = useRef(new Set<string>());

  // Poll for incoming calls every 3 seconds + Realtime subscription
  useEffect(() => {
    if (!isSupabaseConfigured() || !currentUser?.id) return;

    // Initial check
    checkIncomingCalls();

    // Poll every 3s as fallback
    const pollInterval = setInterval(checkIncomingCalls, 3000);

    // Also try Realtime
    const channel = supabase
      .channel(`incoming-calls-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_participants',
          filter: `user_id=eq.${currentUser.id}`,
        },
        () => {
          // Trigger check immediately on realtime event
          checkIncomingCalls();
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, checkIncomingCalls]);

  // Auto-dismiss after 30s
  useEffect(() => {
    if (!incoming) return;
    const timer = setTimeout(() => {
      stopRingtone();
      dismissedRoomIds.current.add(incoming.roomId);
      setIncoming(null);
    }, 30000);
    return () => clearTimeout(timer);
  }, [incoming]);

  const stopRingtone = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const handleAccept = useCallback(async () => {
    if (!incoming) return;
    setJoining(true);
    stopRingtone();

    try {
      await joinCall(incoming.roomId);
      setIncoming(null);
    } catch (err: any) {
      console.error('[IncomingCall] Join failed:', err);
    } finally {
      setJoining(false);
    }
  }, [incoming]);

  const handleDecline = useCallback(() => {
    stopRingtone();
    if (incoming) {
      dismissedRoomIds.current.add(incoming.roomId);
    }
    setIncoming(null);
  }, [incoming]);

  if (!incoming) return null;

  return (
    <div className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-gray-900 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl border border-gray-700/50 animate-in slide-in-from-bottom-4 duration-300">
        {/* Caller info */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
              <UserIcon className="w-10 h-10 text-green-400" />
            </div>
            {/* Pulse ring */}
            <div className="absolute inset-0 w-20 h-20 rounded-full border-2 border-green-400/30 animate-ping" />
          </div>

          <div className="text-center">
            <p className="text-white text-lg font-semibold">{incoming.callerName}</p>
            <p className="text-gray-400 text-sm mt-1">{incoming.title}</p>
          </div>

          <p className="text-green-400 text-sm animate-pulse">수신 통화 중...</p>
        </div>

        {/* Accept / Decline buttons */}
        <div className="flex items-center justify-center gap-8">
          {/* Decline */}
          <button
            onClick={handleDecline}
            className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors shadow-lg shadow-red-600/30"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>

          {/* Accept */}
          <button
            onClick={handleAccept}
            disabled={joining}
            className="w-16 h-16 rounded-full bg-green-600 hover:bg-green-500 flex items-center justify-center transition-colors shadow-lg shadow-green-600/30 disabled:opacity-50"
          >
            <Phone className="w-7 h-7 text-white" />
          </button>
        </div>

        <div className="flex justify-center gap-12 mt-3">
          <span className="text-xs text-gray-500">거절</span>
          <span className="text-xs text-gray-500">수락</span>
        </div>
      </div>
    </div>
  );
}
