/**
 * CosmosEmail — 코스모스 이메일 뷰
 *
 * 카드형 이메일 목록 + Brain AI 분류 아이콘
 * 우측 상단에 📅/✅/📌 아이콘으로 AI 분류 표시
 * 누르면 Brain AI 제안 사항 팝업
 *
 * Behance CentralFlow 레퍼런스 기반 UI
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Mail,
  RefreshCw,
  Calendar,
  CheckSquare,
  FileText,
  Brain,
  Search,
  Star,
  Loader2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { GmailMessage, EmailBrainSuggestion } from '@/types/core';

// Brain AI classification icons
function BrainIcons({ suggestions }: { suggestions: EmailBrainSuggestion[] }) {
  if (!suggestions || suggestions.length === 0) return null;

  const hasEvent = suggestions.some(s => s.suggestedEvent);
  const hasTodo = suggestions.some(s => s.suggestedTodo);
  const hasNote = suggestions.some(s => s.suggestedNote);

  return (
    <div className="flex items-center gap-1">
      {hasEvent && (
        <div className="w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: 'hsla(210, 80%, 55%, 0.15)' }}>
          <Calendar className="w-2.5 h-2.5 text-blue-400" />
        </div>
      )}
      {hasTodo && (
        <div className="w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: 'hsla(142, 70%, 45%, 0.15)' }}>
          <CheckSquare className="w-2.5 h-2.5 text-emerald-400" />
        </div>
      )}
      {hasNote && (
        <div className="w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: 'hsla(260, 70%, 60%, 0.15)' }}>
          <FileText className="w-2.5 h-2.5 text-violet-400" />
        </div>
      )}
    </div>
  );
}

// Suggestion popup
function SuggestionPopup({
  suggestions,
  onClose,
}: {
  suggestions: EmailBrainSuggestion[];
  onClose: () => void;
}) {
  const { language } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-t-2xl p-5 pb-8 animate-slide-in-bottom"
        style={{
          background: 'hsla(240, 10%, 8%, 0.95)',
          backdropFilter: 'blur(24px)',
          borderTop: '1px solid hsla(43, 74%, 55%, 0.1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-4 h-4 text-[hsl(43,74%,55%)]" />
          <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
            {language === 'ko' ? 'Brain AI 제안' : 'Brain AI Suggestions'}
          </span>
        </div>

        <div className="space-y-3 max-h-[50vh] overflow-y-auto">
          {suggestions.map((s, i) => (
            <div
              key={i}
              className="rounded-xl p-3 border"
              style={{
                background: 'hsla(var(--glass-bg))',
                borderColor: 'hsla(var(--glass-border))',
              }}
            >
              <p className="text-[12px] text-[hsl(var(--foreground))] leading-relaxed">
                {s.summary}
              </p>
              <div className="flex items-center gap-2 mt-2">
                {s.suggestedEvent && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-blue-400">
                    <Calendar className="w-3 h-3" />
                    {s.suggestedEvent.title}
                  </span>
                )}
                {s.suggestedTodo && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                    <CheckSquare className="w-3 h-3" />
                    {s.suggestedTodo.title}
                  </span>
                )}
                {s.suggestedNote && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-violet-400">
                    <FileText className="w-3 h-3" />
                    {language === 'ko' ? '중요 기록' : 'Note'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CosmosEmail() {
  const {
    gmailMessages,
    emailBrainSuggestions,
    isGmailLoading,
    fetchGmailMessages,
    analyzeEmailsWithBrain,
  } = useAppStore();
  const { language } = useTranslation();
  const locale = language === 'ko' ? ko : enUS;
  const [selectedEmailSuggestions, setSelectedEmailSuggestions] = useState<EmailBrainSuggestion[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch on mount
  useEffect(() => {
    fetchGmailMessages?.();
  }, []);

  // Filter emails
  const filteredEmails = useMemo(() => {
    if (!searchQuery.trim()) return gmailMessages || [];
    const q = searchQuery.toLowerCase();
    return (gmailMessages || []).filter(e =>
      e.subject?.toLowerCase().includes(q) ||
      e.from?.toLowerCase().includes(q) ||
      e.snippet?.toLowerCase().includes(q)
    );
  }, [gmailMessages, searchQuery]);

  // Get suggestions for a specific email
  const getSuggestionsForEmail = useCallback((messageId: string) => {
    return (emailBrainSuggestions || []).filter(s => s.emailId === messageId);
  }, [emailBrainSuggestions]);

  const handleEmailTap = (messageId: string) => {
    const suggestions = getSuggestionsForEmail(messageId);
    if (suggestions.length > 0) {
      setSelectedEmailSuggestions(suggestions);
    }
  };

  const formatSender = (from: string) => {
    // Extract name from "Name <email>" format
    const match = from?.match(/^(.+?)(?:\s*<.*>)?$/);
    return match?.[1]?.replace(/"/g, '') || from || 'Unknown';
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      return format(date, 'M/d', { locale });
    } catch {
      return '';
    }
  };

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0 px-5 pt-12 pb-3 z-20 space-y-3"
        style={{
          background: 'linear-gradient(to bottom, hsla(240, 10%, 3%, 1) 0%, hsla(240, 10%, 3%, 0.8) 80%, transparent 100%)',
        }}
      >
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-[hsl(var(--foreground))]">
            {language === 'ko' ? '이메일' : 'Email'}
          </h1>
          <button
            onClick={() => fetchGmailMessages?.()}
            disabled={isGmailLoading}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              background: 'hsla(var(--glass-bg))',
              border: '1px solid hsla(var(--glass-border))',
            }}
          >
            {isGmailLoading ? (
              <Loader2 className="w-3.5 h-3.5 text-[hsl(43,74%,55%)] animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
            )}
          </button>
        </div>

        {/* Search bar */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{
            background: 'hsla(var(--glass-bg))',
            border: '1px solid hsla(var(--glass-border))',
          }}
        >
          <Search className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={language === 'ko' ? '이메일 검색...' : 'Search emails...'}
            className="flex-1 bg-transparent text-[13px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none"
          />
        </div>
      </div>

      {/* Email list */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-2 space-y-2">
          {filteredEmails.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Mail className="w-10 h-10 text-[hsl(var(--muted-foreground))] mb-3 opacity-30" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {isGmailLoading
                  ? (language === 'ko' ? '이메일 로딩 중...' : 'Loading emails...')
                  : (language === 'ko' ? '이메일이 없습니다' : 'No emails')}
              </p>
            </div>
          ) : (
            filteredEmails.map(email => {
              const suggestions = getSuggestionsForEmail(email.id);
              const hasSuggestions = suggestions.length > 0;

              return (
                <button
                  key={email.id}
                  onClick={() => handleEmailTap(email.id)}
                  className="w-full text-left rounded-xl p-3.5 border transition-transform active:scale-[0.98]"
                  style={{
                    background: 'hsla(var(--glass-bg))',
                    borderColor: hasSuggestions
                      ? 'hsla(43, 74%, 55%, 0.12)'
                      : 'hsla(var(--glass-border))',
                    boxShadow: hasSuggestions
                      ? '0 0 15px hsla(43, 74%, 55%, 0.05)'
                      : 'none',
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Sender avatar */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
                      style={{
                        background: 'hsla(var(--accent))',
                        color: 'hsl(var(--foreground))',
                      }}
                    >
                      {formatSender(email.from || '').charAt(0).toUpperCase()}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-semibold text-[hsl(var(--foreground))] truncate">
                          {formatSender(email.from || '')}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Brain AI classification icons */}
                          <BrainIcons suggestions={suggestions} />
                          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                            {formatDate(email.date || '')}
                          </span>
                        </div>
                      </div>
                      <p className="text-[12px] font-medium text-[hsl(var(--foreground))] truncate mt-0.5">
                        {email.subject || '(제목 없음)'}
                      </p>
                      <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate mt-0.5">
                        {email.snippet || ''}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Suggestion popup */}
      {selectedEmailSuggestions && (
        <SuggestionPopup
          suggestions={selectedEmailSuggestions}
          onClose={() => setSelectedEmailSuggestions(null)}
        />
      )}
    </div>
  );
}

export default CosmosEmail;
