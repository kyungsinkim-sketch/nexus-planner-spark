/**
 * CallSuggestionsPanel — Shows Brain AI suggestions after a call ends.
 *
 * Polls call_suggestions for the given roomId.
 * Displays event/todo/note suggestions with accept/reject buttons.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  ListTodo,
  FileText,
  Check,
  X,
  CheckCheck,
  Sparkles,
  Loader2,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  getCallSuggestions,
  acceptSuggestion,
  rejectSuggestion,
  acceptAllSuggestions,
  type CallSuggestion,
} from '@/services/callService';

interface CallSuggestionsPanelProps {
  roomId: string;
  onClose: () => void;
}

export function CallSuggestionsPanel({ roomId, onClose }: CallSuggestionsPanelProps) {
  const [suggestions, setSuggestions] = useState<CallSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Poll for suggestions
  useEffect(() => {
    let active = true;
    let attempts = 0;
    const maxAttempts = 20; // 20 * 3s = 1 minute

    const poll = async () => {
      try {
        const sug = await getCallSuggestions(roomId);
        if (!active) return;

        if (sug.length > 0) {
          setSuggestions(sug);
          setLoading(false);
          return; // Stop polling
        }

        attempts++;
        if (attempts >= maxAttempts) {
          setLoading(false);
          return;
        }

        // Keep polling
        setTimeout(poll, 3000);
      } catch {
        if (active) setLoading(false);
      }
    };

    poll();
    return () => { active = false; };
  }, [roomId]);

  const handleAccept = useCallback(async (id: string) => {
    setActionLoading(id);
    try {
      await acceptSuggestion(id);
      setSuggestions(prev => prev.map(s =>
        s.id === id ? { ...s, status: 'accepted' as const } : s
      ));
    } catch (err) {
      console.error('[Suggestions] Accept failed:', err);
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleReject = useCallback(async (id: string) => {
    setActionLoading(id);
    try {
      await rejectSuggestion(id);
      setSuggestions(prev => prev.map(s =>
        s.id === id ? { ...s, status: 'rejected' as const } : s
      ));
    } catch (err) {
      console.error('[Suggestions] Reject failed:', err);
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleAcceptAll = useCallback(async () => {
    setActionLoading('all');
    try {
      await acceptAllSuggestions(roomId);
      setSuggestions(prev => prev.map(s =>
        s.status === 'pending' ? { ...s, status: 'accepted' as const } : s
      ));
    } catch (err) {
      console.error('[Suggestions] Accept all failed:', err);
    } finally {
      setActionLoading(null);
    }
  }, [roomId]);

  const pending = suggestions.filter(s => s.status === 'pending');
  const events = suggestions.filter(s => s.suggestionType === 'event');
  const todos = suggestions.filter(s => s.suggestionType === 'todo');
  const notes = suggestions.filter(s => s.suggestionType === 'note');

  const typeIcon = (type: string) => {
    switch (type) {
      case 'event': return <Calendar className="w-4 h-4 text-blue-400" />;
      case 'todo': return <ListTodo className="w-4 h-4 text-green-400" />;
      case 'note': return <FileText className="w-4 h-4 text-amber-400" />;
      default: return null;
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case 'event': return '일정';
      case 'todo': return '할 일';
      case 'note': return '기록';
      default: return '';
    }
  };

  const categoryLabel = (cat: string | null) => {
    if (!cat) return null;
    const map: Record<string, string> = {
      decision: '결정 사항',
      risk: '리스크',
      budget: '예산',
      key_quote: '핵심 발언',
      followup: '후속 조치',
    };
    return map[cat] || cat;
  };

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] bg-gray-950/95 backdrop-blur-sm flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />
        <p className="text-white text-lg font-medium">Brain AI 분석 중</p>
        <p className="text-white/50 text-sm mt-2">통화 내용에서 일정, 할 일, 중요 기록을 추출하고 있습니다...</p>
        <button
          onClick={onClose}
          className="mt-6 px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/60 text-sm transition-colors"
        >
          건너뛰기
        </button>
      </div>
    );
  }

  // No suggestions
  if (suggestions.length === 0) {
    return (
      <div className="fixed inset-0 z-[9999] bg-gray-950/95 backdrop-blur-sm flex flex-col items-center justify-center">
        <Sparkles className="w-12 h-12 text-gray-500 mb-4" />
        <p className="text-white text-lg font-medium">분석 완료</p>
        <p className="text-white/50 text-sm mt-2">추출된 항목이 없습니다.</p>
        <button
          onClick={onClose}
          className="mt-6 px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
        >
          닫기
        </button>
      </div>
    );
  }

  // Suggestions UI
  return (
    <div className="fixed inset-0 z-[9999] bg-gray-950/95 backdrop-blur-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h2 className="text-white font-semibold">AI 분석 결과</h2>
          <span className="text-xs text-white/50 bg-white/10 px-2 py-0.5 rounded-full">
            {pending.length}개 대기
          </span>
        </div>
        <div className="flex items-center gap-2">
          {pending.length > 1 && (
            <button
              onClick={handleAcceptAll}
              disabled={actionLoading === 'all'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
            >
              {actionLoading === 'all' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
              전체 승인
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-xs transition-colors"
          >
            닫기
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="flex gap-4 px-4 py-3 border-b border-white/5">
        {events.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-blue-400">
            <Calendar className="w-3.5 h-3.5" />
            일정 {events.length}개
          </div>
        )}
        {todos.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-green-400">
            <ListTodo className="w-3.5 h-3.5" />
            할 일 {todos.length}개
          </div>
        )}
        {notes.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-400">
            <FileText className="w-3.5 h-3.5" />
            기록 {notes.length}개
          </div>
        )}
      </div>

      {/* Suggestion cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {suggestions.map(s => {
          const isProcessed = s.status !== 'pending';
          const isLoading = actionLoading === s.id;

          return (
            <div
              key={s.id}
              className={`rounded-xl border p-4 transition-all ${
                s.status === 'accepted'
                  ? 'border-green-500/30 bg-green-500/5'
                  : s.status === 'rejected'
                  ? 'border-gray-700/30 bg-gray-800/30 opacity-40'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              {/* Type badge + title */}
              <div className="flex items-start gap-2">
                <div className="mt-0.5">{typeIcon(s.suggestionType)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-medium text-white/40 uppercase">{typeLabel(s.suggestionType)}</span>
                    {s.noteCategory && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/40">
                        {categoryLabel(s.noteCategory)}
                      </span>
                    )}
                    {s.todoPriority && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        s.todoPriority === 'HIGH' ? 'bg-red-500/20 text-red-400' :
                        s.todoPriority === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-white/10 text-white/40'
                      }`}>
                        {s.todoPriority}
                      </span>
                    )}
                    <span className="text-[10px] text-white/20 ml-auto">{Math.round(s.confidence * 100)}%</span>
                  </div>

                  <p className="text-sm font-medium text-white">{s.title}</p>

                  {s.description && (
                    <p className="text-xs text-white/50 mt-1">{s.description}</p>
                  )}

                  {/* Meta */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {s.eventStart && (
                      <span className="flex items-center gap-1 text-[10px] text-white/40">
                        <Clock className="w-3 h-3" />
                        {new Date(s.eventStart).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {s.todoDueDate && (
                      <span className="flex items-center gap-1 text-[10px] text-white/40">
                        <Clock className="w-3 h-3" />
                        마감: {s.todoDueDate}
                      </span>
                    )}
                  </div>

                  {/* Source quote */}
                  {s.sourceQuote && (
                    <div className="text-[10px] italic text-white/30 border-l-2 border-white/10 pl-2 mt-2">
                      "{s.sourceQuote.substring(0, 120)}{s.sourceQuote.length > 120 ? '...' : ''}"
                    </div>
                  )}
                </div>

                {/* Status indicator */}
                {isProcessed && (
                  <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                    s.status === 'accepted' ? 'bg-green-500/20' : 'bg-white/10'
                  }`}>
                    {s.status === 'accepted' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <X className="w-3.5 h-3.5 text-white/30" />}
                  </div>
                )}
              </div>

              {/* Actions */}
              {!isProcessed && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                  <button
                    onClick={() => handleAccept(s.id)}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    승인
                  </button>
                  <button
                    onClick={() => handleReject(s.id)}
                    disabled={isLoading}
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer — done button when all processed */}
      {pending.length === 0 && suggestions.length > 0 && (
        <div className="p-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium transition-colors"
          >
            완료
          </button>
        </div>
      )}
    </div>
  );
}
