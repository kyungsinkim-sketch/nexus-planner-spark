/**
 * CallWidget — In-App Voice Call with Brain AI suggestions.
 *
 * Features:
 * - 1:1 VoIP call via LiveKit WebRTC
 * - Mute/Speaker toggle
 * - Duration timer
 * - Post-call AI suggestion cards (events, todos, notes)
 * - Accept/reject/accept-all flow
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Loader2,
  Check,
  X,
  CheckCheck,
  Calendar,
  ListTodo,
  FileText,
  ChevronDown,
  Clock,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import {
  createCall,
  joinCall,
  endCall,
  toggleMute,
  toggleSpeaker,
  subscribeCallState,
  getCallSuggestions,
  acceptSuggestion,
  rejectSuggestion,
  acceptAllSuggestions,
  formatDuration,
  type CallState,
  type CallSuggestion,
} from '@/services/callService';
import { useAppStore } from '@/store/appStore';
import type { User } from '@/types/core';

// ─── Sub-Components ──────────────────────────────────

interface SuggestionCardProps {
  suggestion: CallSuggestion;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  loading: boolean;
}

function SuggestionCard({ suggestion, onAccept, onReject, loading }: SuggestionCardProps) {
  const icon = useMemo(() => {
    switch (suggestion.suggestionType) {
      case 'event': return <Calendar className="w-4 h-4 text-blue-400" />;
      case 'todo': return <ListTodo className="w-4 h-4 text-green-400" />;
      case 'note': return <FileText className="w-4 h-4 text-amber-400" />;
    }
  }, [suggestion.suggestionType]);

  const typeLabel = useMemo(() => {
    switch (suggestion.suggestionType) {
      case 'event': return '일정';
      case 'todo': return '할 일';
      case 'note': return '기록';
    }
  }, [suggestion.suggestionType]);

  const categoryLabel = suggestion.noteCategory ? {
    decision: '결정 사항',
    risk: '리스크',
    budget: '예산',
    key_quote: '핵심 발언',
    followup: '후속 조치',
  }[suggestion.noteCategory] : null;

  if (suggestion.status !== 'pending') {
    return (
      <div className={`rounded-lg border p-3 ${
        suggestion.status === 'accepted'
          ? 'border-green-500/30 bg-green-500/5'
          : 'border-gray-600/30 bg-gray-500/5 opacity-50'
      }`}>
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm text-gray-300 line-through={suggestion.status === 'rejected'}">
            {suggestion.title}
          </span>
          {suggestion.status === 'accepted' && <Check className="w-3 h-3 text-green-400 ml-auto" />}
          {suggestion.status === 'rejected' && <X className="w-3 h-3 text-gray-500 ml-auto" />}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-600/50 bg-gray-800/50 p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium text-gray-400 uppercase">{typeLabel}</span>
        {categoryLabel && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400">{categoryLabel}</span>
        )}
        <span className="text-xs text-gray-500 ml-auto">
          {Math.round(suggestion.confidence * 100)}%
        </span>
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-gray-200">{suggestion.title}</p>

      {/* Description */}
      {suggestion.description && (
        <p className="text-xs text-gray-400">{suggestion.description}</p>
      )}

      {/* Meta info */}
      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
        {suggestion.eventStart && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(suggestion.eventStart).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {suggestion.todoDueDate && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            마감: {suggestion.todoDueDate}
          </span>
        )}
        {suggestion.todoPriority && (
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            suggestion.todoPriority === 'HIGH' ? 'bg-red-500/20 text-red-400' :
            suggestion.todoPriority === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-gray-500/20 text-gray-400'
          }`}>
            {suggestion.todoPriority}
          </span>
        )}
      </div>

      {/* Source quote */}
      {suggestion.sourceQuote && (
        <div className="text-xs italic text-gray-500 border-l-2 border-gray-600 pl-2">
          "{suggestion.sourceQuote}"
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onAccept(suggestion.id)}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          승인
        </button>
        <button
          onClick={() => onReject(suggestion.id)}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium transition-colors disabled:opacity-50"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Widget ─────────────────────────────────────

interface CallWidgetProps {
  className?: string;
}

export default function CallWidget({ className }: CallWidgetProps) {
  const users = useAppStore(s => s.users);
  const currentUser = useAppStore(s => s.currentUser);
  const projects = useAppStore(s => s.projects);

  const [callState, setCallState] = useState<CallState | null>(null);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [suggestions, setSuggestions] = useState<CallSuggestion[]>([]);
  const [loadingSuggestionId, setLoadingSuggestionId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [pollTimer, setPollTimer] = useState<ReturnType<typeof setInterval> | null>(null);

  // Subscribe to call state
  useEffect(() => {
    return subscribeCallState(setCallState);
  }, []);

  // Poll for suggestions when processing
  useEffect(() => {
    if (callState?.status === 'processing' && callState.room) {
      const roomId = callState.room.id;
      const timer = setInterval(async () => {
        try {
          const sug = await getCallSuggestions(roomId);
          if (sug.length > 0) {
            setSuggestions(sug);
            setShowSuggestions(true);
            clearInterval(timer);
          }
        } catch { /* ignore */ }
      }, 3000);
      setPollTimer(timer);
      return () => clearInterval(timer);
    }
  }, [callState?.status, callState?.room?.id]);

  // Callable users (exclude self)
  const callableUsers = useMemo(() =>
    users.filter(u => u.id !== currentUser?.id),
    [users, currentUser]
  );

  // ─── Handlers ──────────────────────────────────────

  const handleStartCall = useCallback(async () => {
    if (!selectedUser) return;
    try {
      await createCall(selectedUser, selectedProject || undefined);
    } catch (err: any) {
      console.error('[CallWidget] Start call failed:', err);
    }
  }, [selectedUser, selectedProject]);

  const handleEndCall = useCallback(async () => {
    try {
      await endCall();
    } catch (err: any) {
      console.error('[CallWidget] End call failed:', err);
    }
  }, []);

  const handleAcceptSuggestion = useCallback(async (id: string) => {
    setLoadingSuggestionId(id);
    try {
      await acceptSuggestion(id);
      setSuggestions(prev => prev.map(s =>
        s.id === id ? { ...s, status: 'accepted' as const } : s
      ));
    } catch (err) {
      console.error('[CallWidget] Accept suggestion failed:', err);
    } finally {
      setLoadingSuggestionId(null);
    }
  }, []);

  const handleRejectSuggestion = useCallback(async (id: string) => {
    setLoadingSuggestionId(id);
    try {
      await rejectSuggestion(id);
      setSuggestions(prev => prev.map(s =>
        s.id === id ? { ...s, status: 'rejected' as const } : s
      ));
    } catch (err) {
      console.error('[CallWidget] Reject suggestion failed:', err);
    } finally {
      setLoadingSuggestionId(null);
    }
  }, []);

  const handleAcceptAll = useCallback(async () => {
    if (!callState?.room) return;
    setLoadingSuggestionId('all');
    try {
      await acceptAllSuggestions(callState.room.id);
      setSuggestions(prev => prev.map(s =>
        s.status === 'pending' ? { ...s, status: 'accepted' as const } : s
      ));
    } catch (err) {
      console.error('[CallWidget] Accept all failed:', err);
    } finally {
      setLoadingSuggestionId(null);
    }
  }, [callState?.room]);

  const status = callState?.status || 'idle';
  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');

  // ─── Render ────────────────────────────────────────

  return (
    <div className={`flex flex-col h-full ${className || ''}`}>
      {/* ── Idle: Show dialer ── */}
      {status === 'idle' && !showSuggestions && (
        <div className="flex flex-col gap-3 p-4">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Phone className="w-4 h-4" />
            음성 통화
          </h3>

          {/* User selector */}
          <div className="relative">
            <select
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
              className="w-full appearance-none bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50"
            >
              <option value="">통화 상대 선택...</option>
              {callableUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>

          {/* Project selector (optional) */}
          <div className="relative">
            <select
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
              className="w-full appearance-none bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50"
            >
              <option value="">프로젝트 연결 (선택)</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>

          {/* Call button */}
          <button
            onClick={handleStartCall}
            disabled={!selectedUser}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium transition-colors"
          >
            <Phone className="w-5 h-5" />
            통화 시작
          </button>
        </div>
      )}

      {/* ── Ringing / Connecting ── */}
      {(status === 'creating' || status === 'ringing' || status === 'connecting') && (
        <div className="flex flex-col items-center justify-center gap-4 p-6 flex-1">
          <div className="w-16 h-16 rounded-full bg-green-600/20 flex items-center justify-center animate-pulse">
            <Phone className="w-8 h-8 text-green-400" />
          </div>
          <p className="text-sm text-gray-400">
            {status === 'creating' ? '통화 생성 중...' :
             status === 'ringing' ? '상대방 호출 중...' :
             '연결 중...'}
          </p>
          <button
            onClick={handleEndCall}
            className="px-6 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
          >
            취소
          </button>
        </div>
      )}

      {/* ── Active Call ── */}
      {status === 'active' && callState && (
        <div className="flex flex-col items-center justify-center gap-6 p-6 flex-1">
          {/* Remote participant */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-full bg-blue-600/20 flex items-center justify-center">
              <UserIcon className="w-10 h-10 text-blue-400" />
            </div>
            <p className="text-sm font-medium text-gray-200">
              {callState.remoteParticipantName || '대기 중...'}
            </p>
          </div>

          {/* Duration */}
          <div className="text-3xl font-mono text-gray-300 tabular-nums">
            {formatDuration(callState.durationSeconds)}
          </div>

          {/* Waveform indicator */}
          <div className="flex items-center gap-1 h-8">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-green-400/60 rounded-full animate-pulse"
                style={{
                  height: `${12 + Math.random() * 20}px`,
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: '0.8s',
                }}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => toggleMute()}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                callState.isMuted
                  ? 'bg-red-600/20 text-red-400'
                  : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
              }`}
            >
              {callState.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            <button
              onClick={handleEndCall}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors"
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>

            <button
              onClick={() => toggleSpeaker()}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                !callState.isSpeakerOn
                  ? 'bg-red-600/20 text-red-400'
                  : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
              }`}
            >
              {callState.isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </button>
          </div>
        </div>
      )}

      {/* ── Processing ── */}
      {status === 'processing' && !showSuggestions && (
        <div className="flex flex-col items-center justify-center gap-4 p-6 flex-1">
          <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-200">Brain AI 분석 중</p>
            <p className="text-xs text-gray-500 mt-1">통화 내용을 분석하고 있습니다...</p>
          </div>
        </div>
      )}

      {/* ── Suggestions ── */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="flex flex-col gap-3 p-4 overflow-y-auto flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              AI 제안 ({pendingSuggestions.length}개 대기)
            </h3>
            {pendingSuggestions.length > 1 && (
              <button
                onClick={handleAcceptAll}
                disabled={loadingSuggestionId === 'all'}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-medium transition-colors"
              >
                <CheckCheck className="w-3 h-3" />
                전체 승인
              </button>
            )}
          </div>

          <div className="space-y-2">
            {suggestions.map(s => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                onAccept={handleAcceptSuggestion}
                onReject={handleRejectSuggestion}
                loading={loadingSuggestionId === s.id || loadingSuggestionId === 'all'}
              />
            ))}
          </div>

          {/* Done button */}
          {pendingSuggestions.length === 0 && (
            <button
              onClick={() => {
                setShowSuggestions(false);
                setSuggestions([]);
              }}
              className="mt-2 w-full py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium transition-colors"
            >
              완료
            </button>
          )}
        </div>
      )}

      {/* ── Error ── */}
      {status === 'error' && callState?.error && (
        <div className="flex flex-col items-center justify-center gap-3 p-6 flex-1">
          <div className="w-12 h-12 rounded-full bg-red-600/20 flex items-center justify-center">
            <X className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-sm text-red-400 text-center">{callState.error}</p>
          <button
            onClick={() => setCallState(prev => prev ? { ...prev, status: 'idle', error: null } : prev)}
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm transition-colors"
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
