/**
 * ActiveCallOverlay — Global floating call UI.
 *
 * Shows when a call is active anywhere in the app.
 * Modes:
 *   - Full screen: video grid / audio-only with controls
 *   - PiP (Picture-in-Picture): draggable floating window with mini videos
 *     User can interact with the rest of the app while in PiP mode.
 *
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
  ScreenShare,
  ScreenShareOff,
  MessageSquare,
  Subtitles,
  Languages,
} from 'lucide-react';
import {
  subscribeCallState,
  endCall,
  toggleMute,
  toggleSpeaker,
  toggleCamera,
  toggleScreenShare,
  formatDuration,
  getCurrentRoom,
  startLiveTranscript,
  stopLiveTranscript,
  subscribeTranscript,
  setTranslationEnabled,
  type CallState,
  type TranscriptLine,
} from '@/services/callService';
import { CallSuggestionsPanel } from './CallSuggestionsPanel';
import { useWidgetStore } from '@/stores/widgetStore';

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

/* ─── Local screen share preview ─── */
function LocalScreenPreview({ className }: { className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const room = getCurrentRoom();
    if (!room?.localParticipant || !videoRef.current) return;
    const screenPubs = Array.from(room.localParticipant.trackPublications.values()) as any[];
    const screenPub = screenPubs.find((p: any) => p.source === 'screen_share' && p.track);
    if (screenPub?.track) {
      screenPub.track.attach(videoRef.current);
      return () => { if (videoRef.current) screenPub.track.detach(videoRef.current); };
    }
  }, []);
  return <video ref={videoRef} autoPlay playsInline muted className={className || ''} />;
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
function getGridClass(count: number, isMobile: boolean): string {
  if (isMobile) {
    switch (count) {
      case 1: return 'grid-cols-1 grid-rows-1';
      case 2: return 'grid-cols-1 grid-rows-2'; // Top-bottom on mobile
      case 3:
      case 4: return 'grid-cols-2 grid-rows-2';
      default: return 'grid-cols-2 auto-rows-fr';
    }
  }
  switch (count) {
    case 1: return 'grid-cols-1 grid-rows-1';
    case 2: return 'grid-cols-2 grid-rows-1'; // Side by side on desktop
    case 3: return 'grid-cols-2 grid-rows-2';
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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [translateOn, setTranslateOn] = useState(false);
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to transcript lines
  useEffect(() => {
    if (!captionsOn) return;
    return subscribeTranscript(setTranscriptLines);
  }, [captionsOn]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcriptLines]);

  // Toggle captions
  const toggleCaptions = useCallback(() => {
    if (captionsOn) {
      stopLiveTranscript();
      setCaptionsOn(false);
      setTranslateOn(false);
      setTranslationEnabled(false);
    } else {
      const started = startLiveTranscript('ko-KR');
      if (started) setCaptionsOn(true);
    }
  }, [captionsOn]);

  // Toggle translation (requires captions to be on)
  const toggleTranslate = useCallback(() => {
    if (!captionsOn) {
      // Auto-enable captions first
      const started = startLiveTranscript('ko-KR');
      if (started) {
        setCaptionsOn(true);
        setTranslateOn(true);
        setTranslationEnabled(true);
      }
    } else {
      const next = !translateOn;
      setTranslateOn(next);
      setTranslationEnabled(next);
    }
  }, [captionsOn, translateOn]);

  /* ─── PiP drag state ─── */
  const pipRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ dragging: boolean; startX: number; startY: number; origX: number; origY: number }>({
    dragging: false, startX: 0, startY: 0, origX: 0, origY: 0,
  });
  const [pipPos, setPipPos] = useState({ x: -1, y: -1 }); // -1 = not yet positioned

  // Initialize PiP position on first minimize
  useEffect(() => {
    if (minimized && pipPos.x === -1) {
      setPipPos({ x: window.innerWidth - 320, y: 80 });
    }
  }, [minimized]);

  const onPipPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return; // Don't drag on buttons
    e.preventDefault();
    dragState.current = { dragging: true, startX: e.clientX, startY: e.clientY, origX: pipPos.x, origY: pipPos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pipPos]);

  const onPipPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.dragging) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    const newX = Math.max(0, Math.min(window.innerWidth - 300, dragState.current.origX + dx));
    const newY = Math.max(0, Math.min(window.innerHeight - 200, dragState.current.origY + dy));
    setPipPos({ x: newX, y: newY });
  }, []);

  const onPipPointerUp = useCallback(() => {
    dragState.current.dragging = false;
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const lastDuration = useRef(0);

  // Track room for post-call suggestions
  useEffect(() => {
    if (callState?.room?.id) {
      lastRoomId.current = callState.room.id;
      endHandled.current = false;
    }
    // Track duration while active (before it resets to 0)
    if (callState?.status === 'active' && (callState?.durationSeconds ?? 0) > 0) {
      lastDuration.current = callState.durationSeconds;
    }
    if (callState?.status === 'idle' && lastRoomId.current && !endHandled.current) {
      endHandled.current = true;
      if (lastDuration.current >= 10) {
        setShowSuggestions(true);
      } else {
        lastRoomId.current = null;
      }
      lastDuration.current = 0;
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

  /* ─── PiP (Picture-in-Picture) floating window ─── */
  if (minimized && status === 'active') {
    const remoteParticipants = callState.remoteParticipants || [];
    const hasRemoteVideo = remoteParticipants.some(p => p.videoTrack);
    const hasLocalVideo = callState.isCameraOn;
    const hasAnyVideo = hasRemoteVideo || hasLocalVideo;

    return (
      <div
        ref={pipRef}
        className="fixed z-[9999] select-none animate-in zoom-in-90 duration-200"
        style={{ left: pipPos.x, top: pipPos.y, width: isMobile ? 180 : 300 }}
        onPointerDown={onPipPointerDown}
        onPointerMove={onPipPointerMove}
        onPointerUp={onPipPointerUp}
      >
        <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10 bg-gray-950">
          {/* Video area */}
          <div
            className="relative cursor-grab active:cursor-grabbing"
            style={{ aspectRatio: hasAnyVideo ? '16/10' : '3/1' }}
            onDoubleClick={() => setMinimized(false)}
          >
            {hasAnyVideo ? (
              <>
                {/* Remote video (main) */}
                {hasRemoteVideo ? (
                  <VideoRenderer
                    track={remoteParticipants.find(p => p.videoTrack)?.videoTrack}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                    <span className="text-white/30 text-2xl font-bold">
                      {(callState.remoteParticipantName || '?').charAt(0)}
                    </span>
                  </div>
                )}
                {/* Local video (small overlay, bottom-right) */}
                {hasLocalVideo && (
                  <div className="absolute bottom-1.5 right-1.5 w-16 h-12 rounded-lg overflow-hidden border border-white/20 shadow-lg">
                    <LocalVideoPreview callState={callState} className="w-full h-full object-cover" />
                  </div>
                )}
              </>
            ) : (
              /* Audio-only PiP */
              <div className="absolute inset-0 bg-gray-900 flex items-center justify-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-white text-xs font-medium truncate max-w-[60%]">
                  {callState.remoteParticipantName || '통화 중'}
                </span>
              </div>
            )}
            {/* Duration badge */}
            <div className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-white text-[10px] font-mono tabular-nums">
                {formatDuration(callState.durationSeconds)}
              </span>
            </div>
            {/* Expand button */}
            <button
              onClick={() => setMinimized(false)}
              className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/40 hover:bg-black/60 text-white/70 hover:text-white transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mini controls bar */}
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-gray-900/95">
            <div className="flex items-center gap-1">
              <button
                onClick={() => toggleMute()}
                className={`p-1.5 rounded-full transition-colors ${callState.isMuted ? 'bg-red-500/30 text-red-400' : 'text-white/60 hover:text-white'}`}
              >
                {callState.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => toggleCamera()}
                className={`p-1.5 rounded-full transition-colors ${callState.isCameraOn ? 'bg-blue-500/30 text-blue-400' : 'text-white/60 hover:text-white'}`}
              >
                {callState.isCameraOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => {
                  // Open chat with call target
                  const targetId = callState.targetUserIds?.[0];
                  if (targetId) {
                    useWidgetStore.getState().openMobileDm(targetId);
                  }
                }}
                className="p-1.5 rounded-full transition-colors text-white/60 hover:text-white"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              onClick={() => endCall()}
              className="p-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white transition-colors"
            >
              <PhoneOff className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Minimized bar (non-active states: connecting, ringing, etc.) ─── */
  if (minimized) {
    return (
      <div
        className="fixed bottom-20 right-4 z-[9999] flex items-center gap-3 px-4 py-2 rounded-full bg-green-600 text-white shadow-2xl cursor-pointer animate-in slide-in-from-bottom-4"
        onClick={() => setMinimized(false)}
      >
        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
        <span className="text-sm font-medium">{callState.remoteParticipantName || '통화 중'}</span>
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
      <div className="absolute inset-0 top-14 bottom-[140px] flex items-center justify-center overflow-hidden">
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
          const allParticipants: Array<{ key: string; name: string; videoTrack?: any; screenTrack?: any; isLocal?: boolean }> = [];

          // Add remote participants
          for (const p of remoteParticipants) {
            allParticipants.push({ key: p.identity, name: p.name, videoTrack: p.videoTrack, screenTrack: p.screenTrack });
          }
          // Add local participant
          allParticipants.push({ key: '__local__', name: '나', isLocal: true });

          const hasAnyVideo = remoteParticipants.some(p => p.videoTrack) || hasLocalVideo;
          const totalCount = allParticipants.length;

          // Check if anyone is screen sharing
          const remoteScreenTrack = callState.remoteScreenTrack;
          const localScreenSharing = callState.isScreenSharing;
          const hasScreenShare = !!remoteScreenTrack || localScreenSharing;

          if (hasScreenShare) {
            // ─── Screen share mode: main screen + small video strip ───
            return (
              <div className="w-full h-full flex flex-col p-1.5 gap-1.5">
                {/* Main: screen share content */}
                <div className="flex-1 rounded-2xl bg-gray-900 overflow-hidden relative">
                  {remoteScreenTrack ? (
                    <VideoRenderer track={remoteScreenTrack} className="w-full h-full object-contain" />
                  ) : localScreenSharing ? (
                    <LocalScreenPreview className="w-full h-full object-contain" />
                  ) : null}
                  {/* Screen share label */}
                  <div className="absolute top-2 left-2 bg-green-600/80 backdrop-blur-sm px-2 py-0.5 rounded text-xs text-white font-medium flex items-center gap-1">
                    <ScreenShare className="w-3 h-3" />
                    {remoteScreenTrack ? `${remoteParticipants.find(p => p.screenTrack)?.name || ''}의 화면` : '내 화면'}
                  </div>
                </div>
                {/* Bottom strip: small participant videos */}
                <div className="shrink-0 flex gap-1.5 h-24 overflow-x-auto">
                  {allParticipants.map(p => (
                    <div key={p.key} className="w-32 shrink-0 rounded-xl overflow-hidden bg-gray-900 relative">
                      {p.isLocal && callState.isCameraOn ? (
                        <LocalVideoPreview callState={callState} className="w-full h-full object-cover" />
                      ) : p.videoTrack ? (
                        <VideoRenderer track={p.videoTrack} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <span className="text-white text-lg font-bold">{p.name.charAt(0)}</span>
                        </div>
                      )}
                      <span className="absolute bottom-1 left-1 text-[10px] text-white bg-black/50 px-1 rounded">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          if (hasAnyVideo) {
            // ─── Video mode: grid layout ───
            return (
              <div className={`w-full h-full grid ${getGridClass(totalCount, isMobile)} gap-1.5 p-1.5`}>
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

      {/* ─── Live transcript overlay ─── */}
      {captionsOn && status === 'active' && (
        <div className="absolute bottom-[160px] inset-x-0 z-20 px-4 max-h-[30vh] overflow-y-auto pointer-events-none">
          <div className="max-w-xl mx-auto space-y-1">
            {transcriptLines.slice(-8).map(line => (
              <div
                key={line.id}
                className={`text-center px-3 py-1.5 rounded-lg w-full ${
                  line.isFinal
                    ? 'bg-black/70 text-white text-sm'
                    : 'bg-black/40 text-white/70 text-sm italic'
                }`}
              >
                <div>{line.text}</div>
                {translateOn && line.isFinal && line.translation && (
                  <div className="text-blue-300/90 text-xs mt-0.5">{line.translation}</div>
                )}
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      )}

      {/* ─── Bottom controls ─── */}
      <div className="absolute bottom-0 inset-x-0 z-20 pb-8 pt-3 bg-gray-950">
        <div className="flex items-center justify-center gap-4 flex-wrap max-w-md mx-auto px-4">
          {/* Mute */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => toggleMute()}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                callState.isMuted
                  ? 'bg-red-500/30 text-red-400 ring-2 ring-red-500/50'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {callState.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            <span className="text-xs font-medium text-white/50">{callState.isMuted ? '음소거 중' : '음소거'}</span>
          </div>

          {/* Camera */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => toggleCamera()}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                callState.isCameraOn
                  ? 'bg-blue-500/30 text-blue-400 ring-2 ring-blue-500/50'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {callState.isCameraOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </button>
            <span className="text-xs font-medium text-white/50">{callState.isCameraOn ? '카메라 끄기' : '카메라'}</span>
          </div>

          {/* Screen Share */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => toggleScreenShare()}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  callState.isScreenSharing
                    ? 'bg-green-500/30 text-green-400 ring-2 ring-green-500/50'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {callState.isScreenSharing ? <ScreenShareOff className="w-6 h-6" /> : <ScreenShare className="w-6 h-6" />}
              </button>
            <span className="text-xs font-medium text-white/50">{callState.isScreenSharing ? '공유 중' : '화면공유'}</span>
          </div>

          {/* Chat — minimize to PiP & open DM */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => {
                const targetId = callState.targetUserIds?.[0];
                if (targetId) {
                  setMinimized(true);
                  useWidgetStore.getState().openMobileDm(targetId);
                }
              }}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-all bg-white/10 text-white hover:bg-white/20"
            >
              <MessageSquare className="w-6 h-6" />
            </button>
            <span className="text-xs font-medium text-white/50">채팅</span>
          </div>

          {/* Live Captions (STT) */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={toggleCaptions}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                captionsOn
                  ? 'bg-purple-500/30 text-purple-400 ring-2 ring-purple-500/50'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Subtitles className="w-6 h-6" />
            </button>
            <span className="text-xs font-medium text-white/50">{captionsOn ? '자막 끄기' : '자막'}</span>
          </div>

          {/* Translate */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={toggleTranslate}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                translateOn
                  ? 'bg-blue-500/30 text-blue-400 ring-2 ring-blue-500/50'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Languages className="w-6 h-6" />
            </button>
            <span className="text-xs font-medium text-white/50">{translateOn ? '번역 끄기' : '한↔영'}</span>
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
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                !callState.isSpeakerOn
                  ? 'bg-amber-500/30 text-amber-400 ring-2 ring-amber-500/50'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {callState.isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </button>
            <span className="text-xs font-medium text-white/50">{callState.isSpeakerOn ? '스피커' : '수화기'}</span>
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
