/**
 * ActiveCallOverlay — Global floating call UI.
 *
 * Shows when a call is active anywhere in the app.
 * Displays: remote participant, duration timer, mute/speaker/end buttons.
 * Can be minimized to a small floating bar.
 */

import { useState, useEffect } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Minimize2,
  Maximize2,
  Loader2,
  User as UserIcon,
} from 'lucide-react';
import {
  subscribeCallState,
  endCall,
  toggleMute,
  toggleSpeaker,
  formatDuration,
  type CallState,
} from '@/services/callService';

export function ActiveCallOverlay() {
  const [callState, setCallState] = useState<CallState | null>(null);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    return subscribeCallState(setCallState);
  }, []);

  // Only show during active call states
  const status = callState?.status;
  const showOverlay = status === 'connecting' || status === 'ringing' || status === 'active' || status === 'creating' || status === 'ending' || status === 'error' || status === 'processing';

  if (!showOverlay || !callState) return null;

  // ─── Minimized bar ────────────────────────────────
  if (minimized) {
    return (
      <div
        className="fixed bottom-20 right-4 z-[9999] flex items-center gap-3 px-4 py-2 rounded-full bg-green-600 text-white shadow-2xl cursor-pointer animate-in slide-in-from-bottom-4"
        onClick={() => setMinimized(false)}
      >
        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
        <span className="text-sm font-medium">
          {callState.remoteParticipantName || '통화 중'}
        </span>
        <span className="text-sm font-mono tabular-nums">
          {formatDuration(callState.durationSeconds)}
        </span>
        <Maximize2 className="w-4 h-4" />
      </div>
    );
  }

  // ─── Full overlay ─────────────────────────────────
  return (
    <div className="fixed inset-0 z-[9999] bg-gray-950/95 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300">
      {/* Minimize button */}
      <button
        onClick={() => setMinimized(true)}
        className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 transition-colors"
      >
        <Minimize2 className="w-5 h-5" />
      </button>

      {/* Status */}
      {(status === 'creating' || status === 'ringing' || status === 'connecting') && (
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center animate-pulse">
            <Phone className="w-12 h-12 text-green-400" />
          </div>
          <p className="text-white/70 text-sm">
            {status === 'creating' ? '통화 생성 중...' :
             status === 'ringing' ? '상대방 호출 중...' :
             '연결 중...'}
          </p>
        </div>
      )}

      {/* Active call */}
      {status === 'active' && (
        <>
          {/* Remote participant */}
          <div className="flex flex-col items-center gap-3 mb-6">
            <div className="w-24 h-24 rounded-full bg-blue-500/20 flex items-center justify-center">
              <UserIcon className="w-12 h-12 text-blue-400" />
            </div>
            <p className="text-white text-lg font-medium">
              {callState.remoteParticipantName || '대기 중...'}
            </p>
          </div>

          {/* Duration */}
          <div className="text-5xl font-mono text-white/90 tabular-nums mb-8">
            {formatDuration(callState.durationSeconds)}
          </div>

          {/* Waveform */}
          <div className="flex items-center gap-1.5 h-10 mb-12">
            {[...Array(7)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-green-400/50 rounded-full"
                style={{
                  height: `${8 + Math.sin(Date.now() / 300 + i) * 16}px`,
                  animation: `pulse 0.8s ease-in-out ${i * 0.1}s infinite alternate`,
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* Ending */}
      {status === 'ending' && (
        <div className="flex flex-col items-center gap-4 mb-8">
          <Loader2 className="w-10 h-10 text-white/50 animate-spin" />
          <p className="text-white/50 text-sm">통화 종료 중...</p>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center">
            <PhoneOff className="w-12 h-12 text-red-400" />
          </div>
          <p className="text-red-400 text-sm text-center max-w-xs">
            {callState.error || '통화 연결 실패'}
          </p>
          <button
            onClick={() => {
              // Reset to idle
              endCall();
            }}
            className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
          >
            닫기
          </button>
        </div>
      )}

      {/* Processing */}
      {status === 'processing' && (
        <div className="flex flex-col items-center gap-4 mb-8">
          <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
          <div className="text-center">
            <p className="text-white text-lg font-medium">Brain AI 분석 중</p>
            <p className="text-white/50 text-sm mt-1">통화 내용을 분석하고 있습니다...</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-8">
        {/* Mute */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => toggleMute()}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
              callState.isMuted
                ? 'bg-red-500/30 text-red-400 ring-2 ring-red-500/50'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {callState.isMuted ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
          </button>
          <span className="text-[10px] text-white/50">
            {callState.isMuted ? '음소거 중' : '음소거'}
          </span>
        </div>

        {/* End call */}
        <button
          onClick={() => endCall()}
          className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors shadow-lg shadow-red-600/30"
        >
          <PhoneOff className="w-8 h-8 text-white" />
        </button>

        {/* Volume toggle */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => toggleSpeaker()}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
              !callState.isSpeakerOn
                ? 'bg-amber-500/30 text-amber-400 ring-2 ring-amber-500/50'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {callState.isSpeakerOn ? <Volume2 className="w-7 h-7" /> : <VolumeX className="w-7 h-7" />}
          </button>
          <span className="text-[10px] text-white/50">
            {callState.isSpeakerOn ? '볼륨 크게' : '볼륨 작게'}
          </span>
        </div>
      </div>

      {/* Room info (small) */}
      {callState.room && (
        <p className="absolute bottom-4 text-white/20 text-xs">
          {callState.room.title}
        </p>
      )}
    </div>
  );
}
