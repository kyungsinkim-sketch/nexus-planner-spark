/**
 * CosmosEmail — 스택형 이메일 어시스턴트
 *
 * Vercel multi-tenant 스타일 겹쳐진 카드 UI.
 * Brain AI가 최신 이메일부터 하나씩 보여주며 정보 정리를 도와줌.
 * - 각 이메일 카드 상단에 Brain 분석 결과
 * - 삭제/보관/제안수락 액션
 * - 처리하면 다음 이메일로 넘어감
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Mail, RefreshCw, Calendar, CheckSquare, FileText, Brain,
  Loader2, Trash2, Archive, Check, ChevronDown, ArrowRight,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { GmailMessage, EmailBrainSuggestion } from '@/types/core';

// ─── Brain suggestion inline card ───
function BrainBar({ suggestions }: { suggestions: EmailBrainSuggestion[] }) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="border-b border-white/[0.04] px-4 py-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <Brain className="w-3 h-3 text-white/30" />
        <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider">Brain AI</span>
      </div>
      {suggestions.map((s, i) => (
        <div key={i} className="space-y-1.5">
          <p className="text-[12px] text-white/50 leading-relaxed">{s.summary}</p>
          <div className="flex flex-wrap gap-1.5">
            {s.suggestedEvent && (
              <button className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-blue-500/10 text-blue-400/80 border border-blue-500/10 active:scale-95 transition-transform">
                <Calendar className="w-2.5 h-2.5" />
                <span className="truncate max-w-[140px]">{s.suggestedEvent.title}</span>
                <Check className="w-2.5 h-2.5 ml-0.5" />
              </button>
            )}
            {s.suggestedTodo && (
              <button className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/10 active:scale-95 transition-transform">
                <CheckSquare className="w-2.5 h-2.5" />
                <span className="truncate max-w-[140px]">{s.suggestedTodo.title}</span>
                <Check className="w-2.5 h-2.5 ml-0.5" />
              </button>
            )}
            {s.suggestedNote && (
              <button className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-violet-500/10 text-violet-400/80 border border-violet-500/10 active:scale-95 transition-transform">
                <FileText className="w-2.5 h-2.5" />
                {language === 'ko' ? '기록 저장' : 'Save note'}
                <Check className="w-2.5 h-2.5 ml-0.5" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Placeholder for i18n inside BrainBar
const language = 'ko'; // will be overridden by component

// ─── Single email card (browser window style) ───
function EmailCard({
  email,
  suggestions,
  depth,
  onDelete,
  onArchive,
  onNext,
  isActive,
  lang,
}: {
  email: GmailMessage;
  suggestions: EmailBrainSuggestion[];
  depth: number; // 0 = front, 1 = behind, 2 = further back
  onDelete: () => void;
  onArchive: () => void;
  onNext: () => void;
  isActive: boolean;
  lang: string;
}) {
  const formatSender = (from: string) =>
    from?.match(/^(.+?)(?:\s*<.*>)?$/)?.[1]?.replace(/"/g, '') || from || '';

  const formatDate = (d: string) => {
    try { return format(parseISO(d), lang === 'ko' ? 'M월 d일 HH:mm' : 'MMM d, HH:mm', { locale: lang === 'ko' ? ko : enUS }); }
    catch { return ''; }
  };

  // Stack offset styling
  const stackStyle: React.CSSProperties = {
    position: depth === 0 ? 'relative' : 'absolute',
    top: depth === 0 ? 0 : `${depth * 8}px`,
    left: depth === 0 ? 0 : `${depth * 4}px`,
    right: depth === 0 ? 0 : `${depth * 4}px`,
    zIndex: 10 - depth,
    opacity: depth === 0 ? 1 : depth === 1 ? 0.5 : 0.25,
    transform: depth === 0 ? 'none' : `scale(${1 - depth * 0.03})`,
    pointerEvents: depth === 0 ? 'auto' : 'none',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  };

  return (
    <div style={stackStyle}>
      <div
        className="rounded-xl border border-white/[0.06] overflow-hidden"
        style={{ background: 'rgb(8, 8, 8)' }}
      >
        {/* Browser window title bar */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/[0.04]">
          <div className="flex gap-1">
            <div className="w-[6px] h-[6px] rounded-full bg-white/[0.06]" />
            <div className="w-[6px] h-[6px] rounded-full bg-white/[0.06]" />
            <div className="w-[6px] h-[6px] rounded-full bg-white/[0.06]" />
          </div>
          <div className="flex-1 mx-2">
            <div className="bg-white/[0.03] rounded-md px-2 py-0.5 text-[9px] text-white/15 font-mono truncate text-center">
              {formatSender(email.from || '')}
            </div>
          </div>
        </div>

        {/* Brain AI analysis — top of card */}
        <BrainBar suggestions={suggestions} />

        {/* Email content */}
        <div className="px-4 py-3 space-y-2">
          {/* Sender + date */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0 text-[9px] font-semibold text-white/30">
                {formatSender(email.from || '').charAt(0).toUpperCase()}
              </div>
              <span className="text-[12px] font-medium text-white/60 truncate">
                {formatSender(email.from || '')}
              </span>
            </div>
            <span className="text-[10px] text-white/15 font-mono shrink-0">
              {formatDate(email.date || '')}
            </span>
          </div>

          {/* Subject */}
          <p className="text-[14px] font-medium text-white/80 leading-snug">
            {email.subject || (lang === 'ko' ? '(제목 없음)' : '(no subject)')}
          </p>

          {/* Snippet / body preview */}
          <p className="text-[12px] text-white/30 leading-relaxed line-clamp-4">
            {email.snippet || email.body || ''}
          </p>
        </div>

        {/* Action bar */}
        {isActive && (
          <div className="flex items-center gap-2 px-4 py-3 border-t border-white/[0.04]">
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-red-400/70 bg-red-500/5 border border-red-500/10 active:scale-95 transition-transform"
            >
              <Trash2 className="w-3 h-3" />
              {lang === 'ko' ? '삭제' : 'Delete'}
            </button>
            <button
              onClick={onArchive}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white/40 bg-white/[0.02] border border-white/[0.06] active:scale-95 transition-transform"
            >
              <Archive className="w-3 h-3" />
              {lang === 'ko' ? '보관' : 'Archive'}
            </button>
            <div className="flex-1" />
            <button
              onClick={onNext}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white text-black active:scale-95 transition-transform"
            >
              {lang === 'ko' ? '다음' : 'Next'}
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───
export function CosmosEmail() {
  const {
    gmailMessages, emailBrainSuggestions, isGmailLoading,
    fetchGmailMessages, trashedGmailMessageIds, trashGmailMessage,
  } = useAppStore();
  const { language } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => { fetchGmailMessages?.(); }, []);

  // Sorted newest first, excluding dismissed/trashed
  const sortedEmails = useMemo(() => {
    return (gmailMessages || [])
      .filter(e => !dismissedIds.has(e.id) && !(trashedGmailMessageIds || []).includes(e.id))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [gmailMessages, dismissedIds, trashedGmailMessageIds]);

  const getSuggestions = useCallback((id: string) => {
    return (emailBrainSuggestions || []).filter(s => s.emailId === id);
  }, [emailBrainSuggestions]);

  const handleDelete = useCallback(() => {
    const email = sortedEmails[currentIndex];
    if (!email) return;
    trashGmailMessage?.(email.id);
    // Auto-advance handled by sortedEmails re-filtering
  }, [currentIndex, sortedEmails, trashGmailMessage]);

  const handleArchive = useCallback(() => {
    const email = sortedEmails[currentIndex];
    if (!email) return;
    setDismissedIds(prev => new Set(prev).add(email.id));
  }, [currentIndex, sortedEmails]);

  const handleNext = useCallback(() => {
    if (currentIndex < sortedEmails.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, sortedEmails.length]);

  // Clamp index
  useEffect(() => {
    if (currentIndex >= sortedEmails.length && sortedEmails.length > 0) {
      setCurrentIndex(sortedEmails.length - 1);
    }
  }, [sortedEmails.length, currentIndex]);

  const remaining = sortedEmails.length - currentIndex;

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 pt-14 pb-4 z-20 flex items-center justify-between"
        style={{ background: 'linear-gradient(to bottom, black 70%, transparent)' }}>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            {language === 'ko' ? '이메일' : 'Email'}
          </h1>
          <p className="text-[11px] text-white/20 mt-0.5">
            {sortedEmails.length > 0
              ? (language === 'ko'
                ? `${remaining}개 남음`
                : `${remaining} remaining`)
              : (language === 'ko' ? '모두 처리됨' : 'All done')}
          </p>
        </div>
        <button
          onClick={() => { fetchGmailMessages?.(); setCurrentIndex(0); setDismissedIds(new Set()); }}
          disabled={isGmailLoading}
          className="w-8 h-8 rounded-full flex items-center justify-center border border-white/[0.06]"
        >
          {isGmailLoading
            ? <Loader2 className="w-3.5 h-3.5 text-white/40 animate-spin" />
            : <RefreshCw className="w-3.5 h-3.5 text-white/30" />}
        </button>
      </div>

      {/* Card stack area */}
      <div className="flex-1 relative px-4 pt-2 pb-4 overflow-hidden">
        {sortedEmails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-12 h-12 rounded-full bg-white/[0.02] border border-white/[0.06] flex items-center justify-center mb-3">
              <Mail className="w-5 h-5 text-white/10" />
            </div>
            <p className="text-[13px] text-white/20">
              {isGmailLoading
                ? (language === 'ko' ? '로딩 중...' : 'Loading...')
                : (language === 'ko' ? '처리할 이메일이 없습니다 ✨' : 'All caught up ✨')}
            </p>
          </div>
        ) : (
          <div className="relative" style={{ paddingTop: '16px' }}>
            {/* Render up to 3 stacked cards */}
            {[2, 1, 0].map(depth => {
              const idx = currentIndex + depth;
              const email = sortedEmails[idx];
              if (!email) return null;

              return (
                <EmailCard
                  key={email.id}
                  email={email}
                  suggestions={getSuggestions(email.id)}
                  depth={depth}
                  onDelete={handleDelete}
                  onArchive={handleArchive}
                  onNext={handleNext}
                  isActive={depth === 0}
                  lang={language}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Progress indicator */}
      {sortedEmails.length > 0 && (
        <div className="shrink-0 px-6 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-[2px] bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className="h-full bg-white/20 rounded-full transition-all duration-500"
                style={{ width: `${((currentIndex + 1) / sortedEmails.length) * 100}%` }}
              />
            </div>
            <span className="text-[9px] text-white/15 font-mono">
              {currentIndex + 1}/{sortedEmails.length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default CosmosEmail;
