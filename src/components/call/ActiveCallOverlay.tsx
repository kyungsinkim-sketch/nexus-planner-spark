/**
 * ActiveCallOverlay — Global floating call UI.
 *
 * Shows when a call is active anywhere in the app.
 * Displays: remote participant, duration timer, mute/speaker/end buttons.
 * Can be minimized to a small floating bar.
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
  SwitchCamera,
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

// Video element that attaches to a LiveKit track
function VideoRenderer({ track, className, mirror }: { track: any; className?: string; mirror?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!track || !videoRef.current) return;
    const el = track.attach(videoRef.current);
    return () => { track.detach(el); };
  }, [track]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className={`${className || ''} ${mirror ? 'scale-x-[-1]' : ''}`}
    />
  );
}

// Local camera preview (PIP or grid mode)
function LocalVideoPreview({ callState, isGrid }: { callState: CallState; isGrid?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!callState.isCameraOn || !videoRef.current) return;

    const room = getCurrentRoom();
    if (!room?.localParticipant) return;

    // Find camera track
    const videoPubs = Array.from(room.localParticipant.videoTrackPublications.values()) as any[];
    const videoPub = videoPubs.find((p: any) => p.track);
    if (videoPub?.track) {
      videoPub.track.attach(videoRef.current);
      return () => {
        if (videoRef.current) videoPub.track.detach(videoRef.current);
      };
    }
  }, [callState.isCameraOn]);

  if (!callState.isCameraOn) return null;

  if (isGrid) {
    return (
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover scale-x-[-1]"
      />
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="absolute bottom-28 right-4 w-28 h-40 rounded-xl object-cover border-2 border-white/20 shadow-xl scale-x-[-1] z-10"
    />
  );
}

export function ActiveCallOverlay() {
  const [callState, setCallState] = useState<CallState | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const lastRoomId = useRef<string | null>(null);

  // Track room ID to show suggestions after call ends
  useEffect(() => {
    if (callState?.room?.id) {
      lastRoomId.current = callState.room.id;
    }
    // When call transitions to idle and we had a room, show suggestions
    // Skip if call was too short (<10s) — no meaningful content to analyze
    if (callState?.status === 'idle' && lastRoomId.current && !showSuggestions) {
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

  // Show suggestions panel after call ends
  if (showSuggestions && lastRoomId.current) {
    return (
      <CallSuggestionsPanel
        roomId={lastRoomId.current}
        onClose={() => {
          setShowSuggestions(false);
          lastRoomId.current = null;
        }}
      />
    );
  }

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
          {/* Video grid or audio-only UI */}
          {(() => {
            const videoParticipants = callState.remoteParticipants.filter(p => p.videoTrack);
            const hasAnyVideo = videoParticipants.length > 0 || callState.isCameraOn;
            const totalVideoFeeds = videoParticipants.length + (callState.isCameraOn ? 1 : 0);

            if (hasAnyVideo) {
              // Video call mode — grid layout
              const gridClass = totalVideoFeeds <= 1
                ? 'grid-cols-1'
                : totalVideoFeeds <= 2
                ? 'grid-cols-1 grid-rows-2'
                : totalVideoFeeds <= 4
                ? 'grid-cols-2 grid-rows-2'
                : 'grid-cols-3 grid-rows-2';

              return (
                <>
                  <div className={`absolute inset-0 z-0 grid ${gridClass} gap-1 p-1`}>
                    {/* Remote video feeds */}
                    {videoParticipants.map(p => (
                      <div key={p.identity} className="relative overflow-hidden rounded-lg bg-gray-900">
                        <VideoRenderer track={p.videoTrack!} className="w-full h-full object-cover" />
                        <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-0.5 rounded text-xs text-white">
                          {p.name}
                        </div>
                      </div>
                    ))}
                    {/* Local video (larger in grid, not PIP) */}
                    {callState.isCameraOn && (
                      <div className="relative overflow-hidden rounded-lg bg-gray-900">
                        <LocalVideoPreview callState={callState} isGrid />
                        <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-0.5 rounded text-xs text-white">나</div>
                      </div>
                    )}
                    {/* Audio-only remote participants (no video) */}
                    {callState.remoteParticipants.filter(p => !p.videoTrack).map(p => (
                      <div key={p.identity} className="relative overflow-hidden rounded-lg bg-gray-800 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <UserIcon className="w-8 h-8 text-blue-400" />
                        </div>
                        <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-0.5 rounded text-xs text-white">
                          {p.name}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Gradient overlays */}
                  <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-gray-950/90 to-transparent z-[1]" />
                  <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-gray-950/60 to-transparent z-[1]" />

                  {/* PIP local video when only 1 remote video (1:1 call) */}
                  {videoParticipants.length === 1 && callState.isCameraOn && totalVideoFeeds <= 2 && (
                    <LocalVideoPreview callState={callState} />
                  )}
                </>
              );
            }

            // Audio-only mode
            return (
              <>
                {callState.remoteParticipants.length <= 1 ? (
                  <div className="flex flex-col items-center gap-3 mb-6 z-10">
                    <div className="w-24 h-24 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <UserIcon className="w-12 h-12 text-blue-400" />
                    </div>
                    <p className="text-white text-lg font-medium">
                      {callState.remoteParticipantName || '대기 중...'}
                    </p>
                  </div>
                ) : (
                  /* Multi-party audio: show avatars */
                  <div className="flex flex-wrap items-center justify-center gap-4 mb-6 z-10">
                    {callState.remoteParticipants.map(p => (
                      <div key={p.identity} className="flex flex-col items-center gap-1">
                        <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <UserIcon className="w-8 h-8 text-blue-400" />
                        </div>
                        <span className="text-white text-xs">{p.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}

          {/* Duration overlay */}
          <div className={`z-10 flex flex-col items-center ${callState.remoteParticipants.some(p => p.videoTrack) ? 'absolute top-4' : ''}`}>
            {callState.remoteParticipants.some(p => p.videoTrack) && callState.remoteParticipants.length === 1 && (
              <p className="text-white text-sm font-medium mb-1">
                {callState.remoteParticipantName || ''}
              </p>
            )}
            <div className={`font-mono text-white/90 tabular-nums ${
              callState.remoteParticipants.some(p => p.videoTrack) ? 'text-lg' : 'text-5xl mb-8'
            }`}>
              {formatDuration(callState.durationSeconds)}
            </div>
          </div>

          {/* Waveform (audio-only, no video) */}
          {!callState.remoteParticipants.some(p => p.videoTrack) && !callState.isCameraOn && (
            <div className="flex items-center gap-1.5 h-10 mb-12 z-10">
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
          )}
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
      <div className="flex items-center gap-6 z-10">
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
          <span className="text-[10px] text-white/50">
            {callState.isMuted ? '음소거 중' : '음소거'}
          </span>
        </div>

        {/* Camera toggle */}
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
          <span className="text-[10px] text-white/50">
            {callState.isCameraOn ? '카메라 끄기' : '카메라'}
          </span>
        </div>

        {/* End call */}
        <button
          onClick={() => endCall()}
          className="w-18 h-18 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors shadow-lg shadow-red-600/30 p-5"
        >
          <PhoneOff className="w-7 h-7 text-white" />
        </button>

        {/* Volume toggle */}
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
          <span className="text-[10px] text-white/50">
            {callState.isSpeakerOn ? '스피커' : '수화기'}
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
