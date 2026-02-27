/**
 * IncomingCallDialog — Global incoming call notification.
 *
 * Polls DB every 3s for pending call invites.
 * When current user is participant in a waiting/active room → show incoming call UI.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, PhoneOff, User as UserIcon, Loader2, Video } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAppStore } from '@/stores/appStore';
import { joinCall, getCallState, toggleCamera } from '@/services/callService';

interface IncomingCall {
  roomId: string;
  roomName: string;
  title: string;
  callerId: string;
  callerName: string;
  isVideo: boolean;
}

export function IncomingCallDialog() {
  const currentUser = useAppStore(s => s.currentUser);
  const users = useAppStore(s => s.users);
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [joining, setJoining] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dismissedRoomIds = useRef(new Set<string>());
  const lastCheckRef = useRef<string | null>(null);

  // Check for incoming calls — simple 2-step query
  const checkIncomingCalls = useCallback(async () => {
    if (!currentUser?.id) return;

    // Don't check if already in a call or showing incoming
    const currentCallState = getCallState();
    if (currentCallState.status !== 'idle') return;

    try {
      // Step 1: Find rooms where I'm a participant (not host)
      const { data: myParticipations, error: pErr } = await supabase
        .from('call_participants')
        .select('room_id, role')
        .eq('user_id', currentUser.id)
        .eq('role', 'participant');

      if (pErr) {
        console.error('[IncomingCall] Participant query error:', pErr);
        return;
      }
      if (!myParticipations || myParticipations.length === 0) return;

      const roomIds = myParticipations.map(p => p.room_id);

      // Step 2: Find waiting/active rooms from those
      const { data: activeRooms, error: rErr } = await supabase
        .from('call_rooms')
        .select('id, title, livekit_room_name, status, created_by, created_at, is_video')
        .in('id', roomIds)
        .in('status', ['waiting', 'active'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (rErr) {
        console.error('[IncomingCall] Room query error:', rErr);
        return;
      }
      if (!activeRooms || activeRooms.length === 0) return;

      const room = activeRooms[0];

      // Skip if already dismissed or already showing
      if (dismissedRoomIds.current.has(room.id)) return;
      if (incoming?.roomId === room.id) return;

      // Don't show if I created this room
      if (room.created_by === currentUser.id) return;

      const caller = users.find(u => u.id === room.created_by);

      console.log('[IncomingCall] 📞 Incoming call detected!', room.id, 'from', caller?.name);

      setIncoming({
        roomId: room.id,
        roomName: room.livekit_room_name,
        title: room.title || (room.is_video ? '화상 통화' : '음성 통화'),
        callerId: room.created_by,
        callerName: caller?.name || '알 수 없음',
        isVideo: room.is_video || false,
      });

      // Play ringtone
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio('/ringtone.mp3');
          audioRef.current.loop = true;
        }
        audioRef.current.play().catch(() => {
          console.log('[IncomingCall] Ringtone play blocked (user interaction needed)');
        });
      } catch {}

    } catch (err) {
      console.error('[IncomingCall] Check failed:', err);
    }
  }, [currentUser?.id, users, incoming]);

  // Poll every 3 seconds
  useEffect(() => {
    if (!isSupabaseConfigured() || !currentUser?.id) return;

    console.log('[IncomingCall] 🟢 Polling started for user:', currentUser.id);

    // Initial check
    checkIncomingCalls();

    // Poll every 3s
    const pollInterval = setInterval(checkIncomingCalls, 3000);

    return () => {
      console.log('[IncomingCall] 🔴 Polling stopped');
      clearInterval(pollInterval);
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
      console.log('[IncomingCall] Accepting call, joining room:', incoming.roomId, 'isVideo:', incoming.isVideo);
      await joinCall(incoming.roomId);
      // Auto-enable camera for video calls
      if (incoming.isVideo) {
        setTimeout(() => toggleCamera(), 500);
      }
      setIncoming(null);
    } catch (err: any) {
      console.error('[IncomingCall] Join failed:', err);
      setJoining(false);
    }
  }, [incoming]);

  const handleDecline = useCallback(() => {
    console.log('[IncomingCall] Declined call:', incoming?.roomId);
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
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
              incoming.isVideo ? 'bg-blue-500/20' : 'bg-green-500/20'
            }`}>
              {incoming.isVideo
                ? <Video className="w-10 h-10 text-blue-400" />
                : <UserIcon className="w-10 h-10 text-green-400" />
              }
            </div>
            <div className={`absolute inset-0 w-20 h-20 rounded-full border-2 animate-ping ${
              incoming.isVideo ? 'border-blue-400/30' : 'border-green-400/30'
            }`} />
          </div>

          <div className="text-center">
            <p className="text-white text-lg font-semibold">{incoming.callerName}</p>
            <p className="text-gray-400 text-sm mt-1">{incoming.title}</p>
          </div>

          <p className={`text-sm animate-pulse ${incoming.isVideo ? 'text-blue-400' : 'text-green-400'}`}>
            {incoming.isVideo ? '📹 화상 통화 수신 중...' : '📞 음성 통화 수신 중...'}
          </p>
        </div>

        {/* Accept / Decline buttons */}
        <div className="flex items-center justify-center gap-8">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleDecline}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors shadow-lg shadow-red-600/30"
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
            <span className="text-xs text-gray-500">거절</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleAccept}
              disabled={joining}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors shadow-lg disabled:opacity-50 ${
                incoming.isVideo
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
                  : 'bg-green-600 hover:bg-green-500 shadow-green-600/30'
              }`}
            >
              {joining ? (
                <Loader2 className="w-7 h-7 text-white animate-spin" />
              ) : incoming.isVideo ? (
                <Video className="w-7 h-7 text-white" />
              ) : (
                <Phone className="w-7 h-7 text-white" />
              )}
            </button>
            <span className="text-xs text-gray-500">수락</span>
          </div>
        </div>
      </div>
    </div>
  );
}
