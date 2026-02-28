/**
 * CosmosEmail — 이메일 뷰 (Vercel-minimal)
 *
 * 흑백 카드형, Brain AI 분류 아이콘만 컬러 포인트
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Mail, RefreshCw, Calendar, CheckSquare, FileText, Brain, Search, Loader2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import type { EmailBrainSuggestion } from '@/types/core';

function BrainIcons({ suggestions }: { suggestions: EmailBrainSuggestion[] }) {
  if (!suggestions || suggestions.length === 0) return null;
  const hasEvent = suggestions.some(s => s.suggestedEvent);
  const hasTodo = suggestions.some(s => s.suggestedTodo);
  const hasNote = suggestions.some(s => s.suggestedNote);

  return (
    <div className="flex items-center gap-1">
      {hasEvent && <Calendar className="w-3 h-3 text-blue-400/70" />}
      {hasTodo && <CheckSquare className="w-3 h-3 text-emerald-400/70" />}
      {hasNote && <FileText className="w-3 h-3 text-violet-400/70" />}
    </div>
  );
}

function SuggestionPopup({
  suggestions, onClose,
}: { suggestions: EmailBrainSuggestion[]; onClose: () => void }) {
  const { language } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-t-2xl p-5 pb-8 animate-slide-in-bottom border-t border-white/[0.06]"
        style={{ background: 'rgb(10, 10, 10)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-4 h-4 text-white/40" />
          <span className="text-[13px] font-semibold text-white">
            {language === 'ko' ? 'Brain AI 분석' : 'Brain AI Analysis'}
          </span>
        </div>
        <div className="space-y-2.5 max-h-[50vh] overflow-y-auto">
          {suggestions.map((s, i) => (
            <div key={i} className="rounded-lg p-3 border border-white/[0.06] bg-white/[0.02]">
              <p className="text-[12px] text-white/60 leading-relaxed">{s.summary}</p>
              <div className="flex items-center gap-3 mt-2">
                {s.suggestedEvent && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-blue-400/80">
                    <Calendar className="w-2.5 h-2.5" /> {s.suggestedEvent.title}
                  </span>
                )}
                {s.suggestedTodo && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400/80">
                    <CheckSquare className="w-2.5 h-2.5" /> {s.suggestedTodo.title}
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
  const { gmailMessages, emailBrainSuggestions, isGmailLoading, fetchGmailMessages } = useAppStore();
  const { language } = useTranslation();
  const locale = language === 'ko' ? ko : enUS;
  const [selectedSuggestions, setSelectedSuggestions] = useState<EmailBrainSuggestion[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { fetchGmailMessages?.(); }, []);

  const filteredEmails = useMemo(() => {
    if (!searchQuery.trim()) return gmailMessages || [];
    const q = searchQuery.toLowerCase();
    return (gmailMessages || []).filter(e =>
      e.subject?.toLowerCase().includes(q) || e.from?.toLowerCase().includes(q) || e.snippet?.toLowerCase().includes(q)
    );
  }, [gmailMessages, searchQuery]);

  const getSuggestions = useCallback((id: string) => {
    return (emailBrainSuggestions || []).filter(s => s.emailId === id);
  }, [emailBrainSuggestions]);

  const formatSender = (from: string) => from?.match(/^(.+?)(?:\s*<.*>)?$/)?.[1]?.replace(/"/g, '') || from || '';

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 pt-14 pb-3 z-20 space-y-3"
        style={{ background: 'linear-gradient(to bottom, black 70%, transparent)' }}>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-white tracking-tight">
            {language === 'ko' ? '이메일' : 'Email'}
          </h1>
          <button
            onClick={() => fetchGmailMessages?.()}
            disabled={isGmailLoading}
            className="w-8 h-8 rounded-full flex items-center justify-center border border-white/[0.06]"
          >
            {isGmailLoading
              ? <Loader2 className="w-3.5 h-3.5 text-white/40 animate-spin" />
              : <RefreshCw className="w-3.5 h-3.5 text-white/30" />}
          </button>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02]">
          <Search className="w-3.5 h-3.5 text-white/20" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={language === 'ko' ? '검색...' : 'Search...'}
            className="flex-1 bg-transparent text-[13px] text-white placeholder:text-white/15 outline-none"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-2 space-y-1">
          {filteredEmails.length === 0 ? (
            <div className="flex flex-col items-center py-20">
              <Mail className="w-8 h-8 text-white/10 mb-3" />
              <p className="text-[13px] text-white/20">
                {isGmailLoading ? (language === 'ko' ? '로딩...' : 'Loading...') : (language === 'ko' ? '이메일 없음' : 'No emails')}
              </p>
            </div>
          ) : (
            filteredEmails.map(email => {
              const suggestions = getSuggestions(email.id);
              return (
                <button
                  key={email.id}
                  onClick={() => suggestions.length > 0 && setSelectedSuggestions(suggestions)}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/[0.02] transition-colors border-b border-white/[0.03]"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0 text-[10px] font-semibold text-white/40">
                      {formatSender(email.from || '').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-medium text-white/70 truncate">
                          {formatSender(email.from || '')}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <BrainIcons suggestions={suggestions} />
                          <span className="text-[10px] text-white/15 font-mono">
                            {(() => { try { return format(parseISO(email.date || ''), 'M/d'); } catch { return ''; }})()}
                          </span>
                        </div>
                      </div>
                      <p className="text-[12px] text-white/50 truncate mt-0.5">{email.subject || '(no subject)'}</p>
                      <p className="text-[11px] text-white/20 truncate mt-0.5">{email.snippet || ''}</p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {selectedSuggestions && (
        <SuggestionPopup suggestions={selectedSuggestions} onClose={() => setSelectedSuggestions(null)} />
      )}
    </div>
  );
}

export default CosmosEmail;
