/**
 * ActiveCallOverlay — Global floating call UI.
 *
 * Shows when a call is active anywhere in the app.
 * 1:1 video: side-by-side layout with name badges.
 * Multi-party: responsive grid (2-6+ participants).
 * Audio-only: centered avatar(s) with waveform.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
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
  Video,
  VideoOff,
} from 'lucide-react';
import {
  subscribeCallState,
  endCall,
  toggleMute,
  toggleSpeaker,
  toggleCamera,
  formatDuration,
  getCurrentRoom,
  type CallState,
} from '@/services/callService';
import { CallSuggestionsPanel } from './CallSuggestionsPanel';

/* ─── Video renderer (attaches LiveKit track) ─── */
function VideoRenderer({ track, className, mirror }: { track: any; className?: string; mirror?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!track || !videoRef.current) return;
    const el = track.attach(videoRef.current);
    return () => { track.detach(el); };
  }, [track]);
  return (
    <video ref={videoRef} autoPlay playsInline muted className={`${className || ''} ${mirror ? 'scale-x-[-1]' : ''}`} />
  );
}

/* ─── Local camera preview ─── */
function LocalVideoPreview({ callState, className }: { callState: CallState; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!callState.isCameraOn || !videoRef.current) return;
    const room = getCurrentRoom();
    if (!room?.localParticipant) return;
    const videoPubs = Array.from(room.localParticipant.videoTrackPublications.values()) as any[];
    const videoPub = videoPubs.find((p: any) => p.track);
    if (videoPub?.track) {
      videoPub.track.attach(videoRef.current);
      return () => { if (videoRef.current) videoPub.track.detach(videoRef.current); };
    }
  }, [callState.isCameraOn]);
  if (!callState.isCameraOn) return null;
  return <video ref={videoRef} autoPlay playsInline muted className={`scale-x-[-1] ${className || ''}`} />;
}

/* ─── Participant tile (video or avatar) ─── */
function ParticipantTile({ name, videoTrack, isLocal, callState, count }: {
  name: string;
  videoTrack?: any;
  isLocal?: boolean;
  callState: CallState;
  count: number;
}) {
  // Avatar color based on name hash
  const hue = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gray-900 flex items-center justify-center">
      {isLocal && callState.isCameraOn ? (
        <LocalVideoPreview callState={callState} className="w-full h-full object-cover" />
      ) : videoTrack ? (
        <VideoRenderer track={videoTrack} className="w-full h-full object-cover" />
      ) : (
        /* Audio-only avatar */
        <div className="flex flex-col items-center gap-3">
          <div
            className="rounded-full flex items-center justify-center"
            style={{
              width: count <= 2 ? 96 : count <= 4 ? 72 : 56,
              height: count <= 2 ? 96 : count <= 4 ? 72 : 56,
              background: `hsl(${hue} 50% 30%)`,
            }}
          >
            <span className="text-white font-bold" style={{ fontSize: count <= 2 ? 36 : count <= 4 ? 28 : 22 }}>
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}
      {/* Name badge */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5">
        <div className="bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg flex items-center gap-1.5 max-w-full">
          <UserIcon className="w-3 h-3 text-white/70 flex-shrink-0" />
          <span className="text-white text-xs font-medium truncate">{name}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Grid layout helper ─── */
function getGridClass(count: number): string {
  switch (count) {
    case 1: return 'grid-cols-1 grid-rows-1';
    case 2: return 'grid-cols-2 grid-rows-1'; // Side by side!
    case 3: return 'grid-cols-2 grid-rows-2'; // 2+1
    case 4: return 'grid-cols-2 grid-rows-2';
    case 5:
    case 6: return 'grid-cols-3 grid-rows-2';
    default: return 'grid-cols-3 auto-rows-fr';
  }
}

export function ActiveCallOverlay() {
  const [callState, setCallState] = useState<CallState | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const lastRoomId = useRef<string | null>(null);
  const endHandled = useRef(false);

  // Track room for post-call suggestions
  useEffect(() => {
    if (callState?.room?.id) {
      lastRoomId.current = callState.room.id;
      endHandled.current = false;
    }
    if (callState?.status === 'idle' && lastRoomId.current && !endHandled.current) {
      endHandled.current = true;
      if ((callState?.durationSeconds ?? 0) >= 10) {
        setShowSuggestions(true);
      } else {
        lastRoomId.current = null;
      }
    }
  }, [callState?.status, callState?.room?.id]);

  useEffect(() => {
    return subscribeCallState(setCallState);
  }, []);

  // Auto-close error after 3s
  useEffect(() => {
    if (callState?.status === 'error') {
      const timer = setTimeout(() => endCall(), 3000);
      return () => clearTimeout(timer);
    }
  }, [callState?.status]);

  // Post-call suggestions
  if (showSuggestions && lastRoomId.current) {
    return (
      <CallSuggestionsPanel
        roomId={lastRoomId.current}
        onClose={() => { setShowSuggestions(false); lastRoomId.current = null; }}
      />
    );
  }

  const status = callState?.status;
  const showOverlay = status === 'connecting' || status === 'ringing' || status === 'active' || status === 'creating' || status === 'ending' || status === 'error' || status === 'processing';
  if (!showOverlay || !callState) return null;

  /* ─── Minimized bar ─── */
  if (minimized) {
    return (
      <div
        className="fixed bottom-20 right-4 z-[9999] flex items-center gap-3 px-4 py-2 rounded-full bg-green-600 text-white shadow-2xl cursor-pointer animate-in slide-in-from-bottom-4"
        onClick={() => setMinimized(false)}
      >
        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
        <span className="text-sm font-medium">{callState.remoteParticipantName || '통화 중'}</span>
        <span className="text-sm font-mono tabular-nums">{formatDuration(callState.durationSeconds)}</span>
        <Maximize2 className="w-4 h-4" />
      </div>
    );
  }

  /* ─── Full overlay ─── */
  return (
    <div className="fixed inset-0 z-[9999] bg-gray-950 flex flex-col animate-in fade-in duration-300">
      {/* Top bar: minimize + duration */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {status === 'active' && (
            <>
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-white/80 text-sm font-mono tabular-nums">
                {formatDuration(callState.durationSeconds)}
              </span>
            </>
          )}
        </div>
        <button
          onClick={() => setMinimized(true)}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 transition-colors"
        >
          <Minimize2 className="w-5 h-5" />
        </button>
      </div>

      {/* ─── Content area ─── */}
      <div className="flex-1 flex items-center justify-center">
        {/* Connecting / Ringing / Creating */}
        {(status === 'creating' || status === 'ringing' || status === 'connecting') && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-28 h-28 rounded-full bg-green-500/20 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-green-500/10 flex items-center justify-center animate-pulse">
                <Phone className="w-12 h-12 text-green-400" />
              </div>
            </div>
            {callState.remoteParticipantName && (
              <p className="text-white text-xl font-medium">{callState.remoteParticipantName}</p>
            )}
            <p className="text-white/50 text-sm">
              {status === 'creating' ? '통화 생성 중...' : status === 'ringing' ? '상대방 호출 중...' : '연결 중...'}
            </p>
          </div>
        )}

        {/* Active call */}
        {status === 'active' && (() => {
          const remoteParticipants = callState.remoteParticipants || [];
          const hasLocalVideo = callState.isCameraOn;
          const allParticipants: Array<{ key: string; name: string; videoTrack?: any; isLocal?: boolean }> = [];

          // Add remote participants
          for (const p of remoteParticipants) {
            allParticipants.push({ key: p.identity, name: p.name, videoTrack: p.videoTrack });
          }
          // Add local participant
          allParticipants.push({ key: '__local__', name: '나', isLocal: true });

          const hasAnyVideo = remoteParticipants.some(p => p.videoTrack) || hasLocalVideo;
          const totalCount = allParticipants.length;

          if (hasAnyVideo) {
            // ─── Video mode: grid layout ───
            return (
              <div className={`absolute inset-0 grid ${getGridClass(totalCount)} gap-1.5 p-1.5`}>
                {allParticipants.map(p => (
                  <ParticipantTile
                    key={p.key}
                    name={p.name}
                    videoTrack={p.videoTrack}
                    isLocal={p.isLocal}
                    callState={callState}
                    count={totalCount}
                  />
                ))}
              </div>
            );
          }

          // ─── Audio-only mode ───
          if (remoteParticipants.length <= 1) {
            // 1:1 audio
            const remoteName = callState.remoteParticipantName || '대기 중...';
            const hue = remoteName.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0) % 360;
            return (
              <div className="flex flex-col items-center gap-6">
                <div
                  className="w-32 h-32 rounded-full flex items-center justify-center"
                  style={{ background: `hsl(${hue} 50% 25%)` }}
                >
                  <span className="text-white text-5xl font-bold">{remoteName.charAt(0).toUpperCase()}</span>
                </div>
                <p className="text-white text-2xl font-medium">{remoteName}</p>
                <p className="text-white/40 text-sm font-mono tabular-nums text-4xl">
                  {formatDuration(callState.durationSeconds)}
                </p>
                {/* Waveform */}
                <div className="flex items-center gap-1.5 h-8 mt-2">
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
              </div>
            );
          }

          // Multi-party audio
          return (
            <div className="flex flex-col items-center gap-6">
              <div className="flex flex-wrap items-center justify-center gap-6 max-w-md">
                {remoteParticipants.map(p => {
                  const hue = p.name.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0) % 360;
                  return (
                    <div key={p.identity} className="flex flex-col items-center gap-2">
                      <div
                        className="w-20 h-20 rounded-full flex items-center justify-center"
                        style={{ background: `hsl(${hue} 50% 25%)` }}
                      >
                        <span className="text-white text-2xl font-bold">{p.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <span className="text-white text-xs font-medium">{p.name}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-white/40 font-mono tabular-nums text-3xl mt-4">
                {formatDuration(callState.durationSeconds)}
              </p>
            </div>
          );
        })()}

        {/* Ending */}
        {status === 'ending' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
              <PhoneOff className="w-10 h-10 text-white/30" />
            </div>
            <p className="text-white/50 text-sm">통화 종료 중...</p>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center ${
              callState.error?.includes('거절') ? 'bg-orange-500/20' : 'bg-red-500/20'
            }`}>
              <PhoneOff className={`w-12 h-12 ${
                callState.error?.includes('거절') ? 'text-orange-400' : 'text-red-400'
              }`} />
            </div>
            <p className={`text-sm text-center max-w-xs ${
              callState.error?.includes('거절') ? 'text-orange-400' : 'text-red-400'
            }`}>
              {callState.error || '통화 연결 실패'}
            </p>
            <p className="text-xs text-white/40">잠시 후 자동으로 닫힙니다</p>
          </div>
        )}

        {/* Processing (Brain AI) */}
        {status === 'processing' && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
            <p className="text-white text-lg font-medium">Brain AI 분석 중</p>
            <p className="text-white/50 text-sm">통화 내용을 분석하고 있습니다...</p>
          </div>
        )}
      </div>

      {/* ─── Bottom controls ─── */}
      <div className="relative z-20 pb-8 pt-4">
        {/* Gradient fade above controls when video is showing */}
        {status === 'active' && callState.remoteParticipants?.some(p => p.videoTrack) && (
          <div className="absolute inset-x-0 bottom-full h-32 bg-gradient-to-t from-gray-950 to-transparent pointer-events-none" />
        )}
        <div className="flex items-center justify-center gap-6">
          {/* Mute */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => toggleMute()}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                callState.isMuted
                  ? 'bg-red-500/30 text-red-400 ring-2 ring-red-500/50'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {callState.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            <span className="text-[10px] text-white/50">{callState.isMuted ? '음소거 중' : '음소거'}</span>
          </div>

          {/* Camera */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => toggleCamera()}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                callState.isCameraOn
                  ? 'bg-blue-500/30 text-blue-400 ring-2 ring-blue-500/50'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {callState.isCameraOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </button>
            <span className="text-[10px] text-white/50">{callState.isCameraOn ? '카메라 끄기' : '카메라'}</span>
          </div>

          {/* End call */}
          <button
            onClick={() => endCall()}
            className="w-[72px] h-[72px] rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors shadow-lg shadow-red-600/30"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>

          {/* Speaker */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => toggleSpeaker()}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                !callState.isSpeakerOn
                  ? 'bg-amber-500/30 text-amber-400 ring-2 ring-amber-500/50'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {callState.isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </button>
            <span className="text-[10px] text-white/50">{callState.isSpeakerOn ? '스피커' : '수화기'}</span>
          </div>
        </div>
      </div>

      {/* Room info */}
      {callState.room && (
        <p className="absolute bottom-2 left-0 right-0 text-center text-white/15 text-xs">
          {callState.room.title}
        </p>
      )}
    </div>
  );
}
