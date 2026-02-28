/**
 * CosmosEmail — 스택형 이메일 어시스턴트
 *
 * Vercel multi-tenant 스타일 겹쳐진 브라우저 창 UI.
 * Brain AI가 최신 이메일부터 하나씩 보여주며 정보 정리를 도와줌.
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Mail, RefreshCw, Calendar, CheckSquare, FileText, Brain,
  Loader2, Trash2, Archive, Check, ArrowRight, Reply, Send, X,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { GmailMessage, EmailBrainSuggestion } from '@/types/core';

// ─── Brain suggestion inline ───
function BrainBar({
  suggestions,
  onConfirm,
  onReject,
  lang,
}: {
  suggestions: EmailBrainSuggestion[];
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  lang: string;
}) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="border-b border-white/[0.04] px-4 py-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <Brain className="w-3 h-3 text-white/30" />
        <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider">Brain AI</span>
      </div>
      {suggestions.map((s) => (
        <div key={s.id} className="space-y-1.5">
          <p className="text-[12px] text-white/50 leading-relaxed">{s.summary}</p>
          <div className="flex flex-wrap gap-1.5">
            {s.suggestedEvent && s.status === 'pending' && (
              <button
                onClick={() => onConfirm(s.id)}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-blue-500/10 text-blue-400/80 border border-blue-500/10 active:scale-95 transition-transform"
              >
                <Calendar className="w-2.5 h-2.5" />
                <span className="truncate max-w-[120px]">{s.suggestedEvent.title}</span>
                <Check className="w-2.5 h-2.5 ml-0.5" />
              </button>
            )}
            {s.suggestedTodo && s.status === 'pending' && (
              <button
                onClick={() => onConfirm(s.id)}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/10 active:scale-95 transition-transform"
              >
                <CheckSquare className="w-2.5 h-2.5" />
                <span className="truncate max-w-[120px]">{s.suggestedTodo.title}</span>
                <Check className="w-2.5 h-2.5 ml-0.5" />
              </button>
            )}
            {s.suggestedNote && s.status === 'pending' && (
              <button
                onClick={() => onConfirm(s.id)}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-violet-500/10 text-violet-400/80 border border-violet-500/10 active:scale-95 transition-transform"
              >
                <FileText className="w-2.5 h-2.5" />
                {lang === 'ko' ? '기록 저장' : 'Save note'}
                <Check className="w-2.5 h-2.5 ml-0.5" />
              </button>
            )}
            {s.status === 'executed' && (
              <span className="text-[10px] text-emerald-400/50">✓ {lang === 'ko' ? '완료' : 'Done'}</span>
            )}
            {s.status === 'rejected' && (
              <span className="text-[10px] text-white/20">— {lang === 'ko' ? '무시됨' : 'Dismissed'}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Reply composer ───
function ReplyComposer({
  email,
  onSend,
  onClose,
  lang,
}: {
  email: GmailMessage;
  onSend: (body: string) => Promise<void>;
  onClose: () => void;
  lang: string;
}) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const handleSend = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    await onSend(body.trim());
    setSending(false);
    onClose();
  };

  const formatSender = (from: string) =>
    from?.match(/^(.+?)(?:\s*<.*>)?$/)?.[1]?.replace(/"/g, '') || from || '';

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full rounded-t-2xl border-t border-white/[0.06] p-4 pb-6 animate-slide-in-bottom"
        style={{ background: 'rgb(10, 10, 10)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-[12px] text-white/40">
            {lang === 'ko' ? '답장:' : 'Reply to:'} {formatSender(email.from || '')}
          </p>
          <button onClick={onClose} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/5">
            <X className="w-3.5 h-3.5 text-white/30" />
          </button>
        </div>
        <textarea
          ref={textareaRef}
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder={lang === 'ko' ? '답장 내용...' : 'Write a reply...'}
          className="w-full h-24 bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 text-[13px] text-white/70 placeholder:text-white/15 outline-none resize-none"
        />
        <button
          onClick={handleSend}
          disabled={!body.trim() || sending}
          className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[12px] font-medium bg-white text-black disabled:opacity-30 active:scale-[0.98] transition-transform"
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {lang === 'ko' ? '보내기' : 'Send'}
        </button>
      </div>
    </div>
  );
}

// ─── Single email card ───
function EmailCard({
  email, suggestions, depth, onDelete, onArchive, onNext, onReply,
  onConfirmSuggestion, onRejectSuggestion, isActive, lang,
}: {
  email: GmailMessage;
  suggestions: EmailBrainSuggestion[];
  depth: number;
  onDelete: () => void;
  onArchive: () => void;
  onNext: () => void;
  onReply: () => void;
  onConfirmSuggestion: (id: string) => void;
  onRejectSuggestion: (id: string) => void;
  isActive: boolean;
  lang: string;
}) {
  const formatSender = (from: string) =>
    from?.match(/^(.+?)(?:\s*<.*>)?$/)?.[1]?.replace(/"/g, '') || from || '';

  const formatDate = (d: string) => {
    try { return format(parseISO(d), lang === 'ko' ? 'M월 d일 HH:mm' : 'MMM d, HH:mm', { locale: lang === 'ko' ? ko : enUS }); }
    catch { return ''; }
  };

  return (
    <div
      className="absolute left-0 right-0 transition-all duration-500 ease-out"
      style={{
        top: `${depth * 12}px`,
        zIndex: 10 - depth,
        opacity: depth === 0 ? 1 : depth === 1 ? 0.4 : 0.15,
        transform: `scale(${1 - depth * 0.04}) translateY(0)`,
        pointerEvents: depth === 0 ? 'auto' : 'none',
        filter: depth > 0 ? 'blur(0.5px)' : 'none',
      }}
    >
      <div
        className="rounded-xl border overflow-hidden"
        style={{
          background: 'rgb(8, 8, 8)',
          borderColor: depth === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
        }}
      >
        {/* Browser title bar */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/[0.04]">
          <div className="flex gap-1">
            <div className="w-[6px] h-[6px] rounded-full bg-red-500/40" />
            <div className="w-[6px] h-[6px] rounded-full bg-yellow-500/40" />
            <div className="w-[6px] h-[6px] rounded-full bg-green-500/40" />
          </div>
          <div className="flex-1 mx-2">
            <div className="bg-white/[0.03] rounded-md px-2 py-0.5 text-[9px] text-white/15 font-mono truncate text-center">
              {formatSender(email.from || '')}
            </div>
          </div>
        </div>

        {/* Brain AI bar */}
        <BrainBar
          suggestions={suggestions}
          onConfirm={onConfirmSuggestion}
          onReject={onRejectSuggestion}
          lang={lang}
        />

        {/* Email content */}
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0 text-[9px] font-semibold text-white/30">
                {formatSender(email.from || '').charAt(0).toUpperCase()}
              </div>
              <span className="text-[12px] font-medium text-white/60 truncate">
                {formatSender(email.from || '')}
              </span>
            </div>
            <span className="text-[10px] text-white/15 font-mono shrink-0">{formatDate(email.date || '')}</span>
          </div>
          <p className="text-[14px] font-medium text-white/80 leading-snug">
            {email.subject || (lang === 'ko' ? '(제목 없음)' : '(no subject)')}
          </p>
          <p className="text-[12px] text-white/30 leading-relaxed line-clamp-5">
            {email.snippet || email.body || ''}
          </p>
        </div>

        {/* Action bar */}
        {isActive && (
          <div className="flex items-center gap-2 px-4 py-3 border-t border-white/[0.04]">
            <button onClick={onDelete}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-red-400/70 bg-red-500/5 border border-red-500/10 active:scale-95 transition-transform">
              <Trash2 className="w-3 h-3" />
            </button>
            <button onClick={onArchive}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white/30 bg-white/[0.02] border border-white/[0.06] active:scale-95 transition-transform">
              <Archive className="w-3 h-3" />
            </button>
            <button onClick={onReply}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white/30 bg-white/[0.02] border border-white/[0.06] active:scale-95 transition-transform">
              <Reply className="w-3 h-3" />
            </button>
            <div className="flex-1" />
            <button onClick={onNext}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white text-black active:scale-95 transition-transform">
              {lang === 'ko' ? '다음' : 'Next'}
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ───
export function CosmosEmail() {
  const {
    gmailMessages, emailSuggestions, isGmailLoading,
    syncGmail, trashEmail, confirmEmailSuggestion, rejectEmailSuggestion,
    replyToEmail, analyzeEmail,
  } = useAppStore();
  const { language } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [replyingEmail, setReplyingEmail] = useState<GmailMessage | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => { syncGmail?.(); }, []);

  // Auto-analyze current email if no suggestions
  const sortedEmails = useMemo(() => {
    return (gmailMessages || [])
      .filter(e => !dismissedIds.has(e.id))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [gmailMessages, dismissedIds]);

  const currentEmail = sortedEmails[currentIndex];

  // Trigger Brain analysis for current email
  useEffect(() => {
    if (!currentEmail || analyzing) return;
    const hasSuggestions = (emailSuggestions || []).some(s => s.emailId === currentEmail.id);
    if (!hasSuggestions && analyzeEmail) {
      setAnalyzing(true);
      analyzeEmail(currentEmail.id).finally(() => setAnalyzing(false));
    }
  }, [currentEmail?.id, emailSuggestions]);

  const getSuggestions = useCallback((id: string) => {
    return (emailSuggestions || []).filter(s => s.emailId === id);
  }, [emailSuggestions]);

  const handleDelete = useCallback(async () => {
    if (!currentEmail) return;
    await trashEmail?.(currentEmail.id);
  }, [currentEmail, trashEmail]);

  const handleArchive = useCallback(() => {
    if (!currentEmail) return;
    setDismissedIds(prev => new Set(prev).add(currentEmail.id));
  }, [currentEmail]);

  const handleNext = useCallback(() => {
    if (currentIndex < sortedEmails.length - 1) setCurrentIndex(prev => prev + 1);
  }, [currentIndex, sortedEmails.length]);

  const handleReply = useCallback(async (body: string) => {
    if (!replyingEmail) return;
    await replyToEmail?.(replyingEmail.id, body);
  }, [replyingEmail, replyToEmail]);

  useEffect(() => {
    if (currentIndex >= sortedEmails.length && sortedEmails.length > 0) {
      setCurrentIndex(Math.max(0, sortedEmails.length - 1));
    }
  }, [sortedEmails.length, currentIndex]);

  const remaining = Math.max(0, sortedEmails.length - currentIndex);

  // Calculate stack height for container
  const stackCount = Math.min(3, sortedEmails.length - currentIndex);

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
              ? (language === 'ko' ? `${remaining}개 남음` : `${remaining} remaining`)
              : (language === 'ko' ? '모두 처리됨' : 'All done')}
            {analyzing && (
              <span className="ml-2 text-white/30">
                <Loader2 className="w-3 h-3 inline animate-spin" /> {language === 'ko' ? '분석 중...' : 'Analyzing...'}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => { syncGmail?.(true); setCurrentIndex(0); setDismissedIds(new Set()); }}
          disabled={isGmailLoading}
          className="w-8 h-8 rounded-full flex items-center justify-center border border-white/[0.06]"
        >
          {isGmailLoading
            ? <Loader2 className="w-3.5 h-3.5 text-white/40 animate-spin" />
            : <RefreshCw className="w-3.5 h-3.5 text-white/30" />}
        </button>
      </div>

      {/* Card stack */}
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
          <div className="relative" style={{ minHeight: '300px' }}>
            {/* Render stacked cards (back to front) */}
            {[2, 1, 0].map(depth => {
              const idx = currentIndex + depth;
              const email = sortedEmails[idx];
              if (!email) return null;

              return (
                <EmailCard
                  key={`${email.id}-${depth}`}
                  email={email}
                  suggestions={getSuggestions(email.id)}
                  depth={depth}
                  onDelete={handleDelete}
                  onArchive={handleArchive}
                  onNext={handleNext}
                  onReply={() => setReplyingEmail(email)}
                  onConfirmSuggestion={(id) => confirmEmailSuggestion?.(id)}
                  onRejectSuggestion={(id) => rejectEmailSuggestion?.(id)}
                  isActive={depth === 0}
                  lang={language}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Progress */}
      {sortedEmails.length > 0 && (
        <div className="shrink-0 px-6 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-[2px] bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className="h-full bg-white/20 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, ((currentIndex + 1) / sortedEmails.length) * 100)}%` }}
              />
            </div>
            <span className="text-[9px] text-white/15 font-mono">
              {Math.min(currentIndex + 1, sortedEmails.length)}/{sortedEmails.length}
            </span>
          </div>
        </div>
      )}

      {/* Reply composer */}
      {replyingEmail && (
        <ReplyComposer
          email={replyingEmail}
          onSend={handleReply}
          onClose={() => setReplyingEmail(null)}
          lang={language}
        />
      )}
    </div>
  );
}

export default CosmosEmail;
