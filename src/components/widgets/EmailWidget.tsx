/**
 * EmailWidget — Gmail integration with Brain AI analysis.
 *
 * Shows:
 * - New emails fetched incrementally from Gmail API
 * - Brain AI suggestions (events, todos, important notes, date inconsistencies)
 * - Confirm/reject/reply actions per suggestion
 *
 * Layout: Email list with inline Brain suggestion cards.
 * Frameless mode — no WidgetContainer header.
 */

import { useEffect, useCallback, useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { startGoogleOAuth, getGoogleCalendarStatus } from '@/services/googleCalendarService';
import {
  Mail,
  RefreshCw,
  Calendar,
  CheckSquare,
  FileText,
  AlertTriangle,
  MessageSquare,
  Check,
  X,
  Loader2,
  Brain,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
  Pencil,
  Reply,
} from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';
import type { EmailBrainSuggestion, BrainActionStatus, GmailMessage } from '@/types/core';
import EmailReplyDialog from './EmailReplyDialog';
import { ComposeEmailDialog } from './ComposeEmailDialog';
import { SuggestionReviewDialog } from './SuggestionReviewDialog';

// ─── Status Badge (reuses BrainActionBubble pattern) ────

function StatusBadge({ status }: { status: BrainActionStatus }) {
  switch (status) {
    case 'pending':
      return (
        <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <Clock className="w-2.5 h-2.5" /> 대기 중
        </span>
      );
    case 'confirmed':
      return (
        <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400">
          <Loader2 className="w-2.5 h-2.5 animate-spin" /> 처리 중
        </span>
      );
    case 'executed':
      return (
        <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-2.5 h-2.5" /> 완료
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-gray-500/15 text-gray-500">
          <XCircle className="w-2.5 h-2.5" /> 무시됨
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-500">
          <AlertTriangle className="w-2.5 h-2.5" /> 실패
        </span>
      );
    default:
      return null;
  }
}

// ─── Suggestion Card ─────────────────────────────────

function SuggestionCard({
  suggestion,
  onConfirm,
  onReject,
  onReply,
}: {
  suggestion: EmailBrainSuggestion;
  onConfirm: () => void;
  onReject: () => void;
  onReply: () => void;
}) {
  const { projects } = useAppStore();
  const isPending = suggestion.status === 'pending';
  const isTerminal = ['executed', 'rejected', 'failed'].includes(suggestion.status);

  // Resolve matched project name
  const matchedProjectId = suggestion.suggestedEvent?.projectId || suggestion.suggestedTodo?.projectId;
  const matchedProject = matchedProjectId ? projects.find(p => p.id === matchedProjectId) : undefined;

  return (
    <div className={`mt-1.5 rounded-lg border p-2 transition-all ${
      isTerminal ? 'opacity-60' : 'border-primary/20 bg-primary/5'
    }`}>
      {/* Header: intent icon + summary + status */}
      <div className="flex items-start gap-1.5 mb-1">
        <Brain className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-medium text-primary">Brain 제안</span>
            {matchedProject && (
              <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 font-medium truncate max-w-[120px]">
                {matchedProject.title}
              </span>
            )}
            <StatusBadge status={suggestion.status} />
          </div>
          <p className="text-[11px] text-foreground/80 mt-0.5">{suggestion.summary}</p>
        </div>
      </div>

      {/* Date inconsistency warning */}
      {suggestion.dateInconsistency && (
        <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 mt-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-[10px]">
            <p className="font-medium text-amber-600 dark:text-amber-400">
              날짜 불일치: {suggestion.dateInconsistency.mentioned} → 실제 {suggestion.dateInconsistency.actualDay}
            </p>
            <p className="text-amber-600/80 dark:text-amber-400/80 mt-0.5">
              {suggestion.dateInconsistency.correction}
            </p>
          </div>
        </div>
      )}

      {/* Suggested items list */}
      <div className="mt-1.5 space-y-1">
        {suggestion.suggestedEvent && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Calendar className="w-3 h-3 text-blue-500" />
            <span className="truncate">일정: {suggestion.suggestedEvent.title}</span>
            {suggestion.suggestedEvent.location && (
              <span className="text-muted-foreground/60">· {suggestion.suggestedEvent.location}</span>
            )}
          </div>
        )}
        {suggestion.suggestedTodo && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <CheckSquare className="w-3 h-3 text-green-500" />
            <span className="truncate">할 일: {suggestion.suggestedTodo.title}</span>
          </div>
        )}
        {suggestion.suggestedNote && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <FileText className="w-3 h-3 text-violet-500" />
            <span className="truncate">중요 기록: {suggestion.suggestedNote.split('\n')[0]}</span>
          </div>
        )}
      </div>

      {/* Action buttons — only for pending */}
      {isPending && (
        <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-border/30">
          <button
            onClick={onConfirm}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
          >
            <Check className="w-3 h-3" /> 확인
          </button>
          {suggestion.suggestedReplyDraft && (
            <button
              onClick={onReply}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-colors"
            >
              <MessageSquare className="w-3 h-3" /> 답장
            </button>
          )}
          <button
            onClick={onReject}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md hover:bg-muted/50 text-muted-foreground transition-colors ml-auto"
          >
            <X className="w-3 h-3" /> 무시
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Email Item ──────────────────────────────────────

function EmailItem({
  emailId,
  suggestions,
  onConfirm,
  onReject,
  onReply,
  onTrash,
  onAnalyze,
  onDirectReply,
  onMarkAsRead,
}: {
  emailId: string;
  suggestions: EmailBrainSuggestion[];
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  onReply: (id: string) => void;
  onTrash: (id: string) => void;
  onAnalyze: (id: string) => void;
  onDirectReply: (emailId: string) => void;
  onMarkAsRead: (emailId: string) => void;
}) {
  const { gmailMessages } = useAppStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const email = gmailMessages.find(m => m.id === emailId);
  if (!email) return null;

  // Parse sender name and email from "Name <email>" format
  const senderMatch = email.from.match(/^(.+?)\s*<(.+?)>/);
  const senderName = senderMatch ? senderMatch[1].trim() : email.from;
  const senderEmail = senderMatch ? senderMatch[2] : email.from;

  const dateStr = new Date(email.date).toLocaleDateString([], {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="border-b border-border/30 last:border-b-0">
      {/* Email header — clickable */}
      <div
        className="flex items-start gap-2 px-2 py-2 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => {
          const willExpand = !isExpanded;
          setIsExpanded(willExpand);
          // Auto mark as read when expanding an unread email
          if (willExpand && email.isUnread) {
            onMarkAsRead(emailId);
          }
        }}
      >
        <Mail className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${email.isUnread ? 'text-primary' : 'text-muted-foreground/50'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-medium truncate ${email.isUnread ? 'text-foreground' : 'text-muted-foreground'}`}>
              {senderName}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">{dateStr}</span>
            {suggestions.length > 0 && (
              <Brain className="w-3 h-3 text-primary shrink-0" />
            )}
          </div>
          <p className={`text-[11px] ${isExpanded ? '' : 'truncate'} ${email.isUnread ? 'text-foreground/90 font-medium' : 'text-muted-foreground'}`}>
            {email.subject}
          </p>
          {!isExpanded && (
            <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">{email.snippet}</p>
          )}
        </div>
      </div>

      {/* Expanded email body */}
      {isExpanded && (
        <div className="px-3 pb-2 space-y-2">
          {/* Sender/recipient details */}
          <div className="text-[10px] text-muted-foreground/70 space-y-0.5 pl-5">
            <p>From: {senderName} &lt;{senderEmail}&gt;</p>
            <p>To: {email.to.join(', ')}</p>
            {email.cc && email.cc.length > 0 && <p>Cc: {email.cc.join(', ')}</p>}
          </div>
          {/* Email body */}
          <div className="pl-5 text-[11px] text-foreground/80 whitespace-pre-wrap break-words max-h-48 overflow-auto rounded-md bg-muted/20 p-2">
            {email.body || email.snippet}
          </div>
          {/* Action buttons: Reply + Brain Analyze + Trash */}
          <div className="flex items-center gap-1.5 pl-5 mt-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); onDirectReply(emailId); }}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-colors"
              title="답장"
            >
              <Reply className="w-3 h-3" /> 답장
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onAnalyze(emailId); }}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 dark:text-violet-400 transition-colors"
              title="Brain AI 분석"
            >
              <Brain className="w-3 h-3" /> Brain 분석
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onTrash(emailId); }}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors ml-auto"
              title="이메일 삭제"
            >
              <Trash2 className="w-3 h-3" /> 삭제
            </button>
          </div>
        </div>
      )}

      {/* Brain suggestions for this email */}
      {(isExpanded || suggestions.some(s => s.status === 'pending')) && suggestions.length > 0 && (
        <div className="px-2 pb-2">
          {suggestions.map(s => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              onConfirm={() => onConfirm(s.id)}
              onReject={() => onReject(s.id)}
              onReply={() => onReply(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Widget ─────────────────────────────────────

function EmailWidget({ context: _context }: { context: WidgetDataContext }) {
  const { t } = useTranslation();
  const {
    currentUser,
    gmailMessages,
    emailSuggestions,
    gmailSyncing,
    gmailLastSyncAt,
    syncGmail,
    trashEmail,
    markEmailAsRead,
    analyzeEmail,
    rejectEmailSuggestion,
  } = useAppStore();

  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [replyDialogSuggestionId, setReplyDialogSuggestionId] = useState<string | null>(null);
  const [composeDialogOpen, setComposeDialogOpen] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<GmailMessage | null>(null);
  const [reviewSuggestionId, setReviewSuggestionId] = useState<string | null>(null);

  // Check Gmail connection status
  useEffect(() => {
    if (!currentUser) return;
    getGoogleCalendarStatus(currentUser.id).then(status => {
      setIsConnected(status.isConnected);
    });
  }, [currentUser]);

  // Auto-sync on mount + 1-minute interval + visibility-based sync
  useEffect(() => {
    if (!currentUser || isConnected === false) return;
    // Initial sync — force full fetch to ensure new emails appear
    syncGmail(true);
    // Polling every 60 seconds for near-realtime feel
    const interval = setInterval(() => syncGmail(), 60 * 1000);
    // Sync when tab regains visibility (user returns from another app/tab)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') syncGmail();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    // Sync on window focus (e.g. Alt-Tab back)
    const handleFocus = () => syncGmail();
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, isConnected]);

  const handleConnect = useCallback(() => {
    if (currentUser) {
      startGoogleOAuth(currentUser.id);
    }
  }, [currentUser]);

  const handleRefresh = useCallback(() => {
    syncGmail();
  }, [syncGmail]);

  const handleReply = useCallback((suggestionId: string) => {
    setReplyDialogSuggestionId(suggestionId);
  }, []);

  const handleTrash = useCallback((messageId: string) => {
    trashEmail(messageId);
  }, [trashEmail]);

  const handleMarkAsRead = useCallback((messageId: string) => {
    markEmailAsRead(messageId);
  }, [markEmailAsRead]);

  const handleAnalyze = useCallback((messageId: string) => {
    analyzeEmail(messageId);
  }, [analyzeEmail]);

  const handleDirectReply = useCallback((emailId: string) => {
    const email = gmailMessages.find(m => m.id === emailId);
    if (email) {
      setReplyToMessage(email);
      setComposeDialogOpen(true);
    }
  }, [gmailMessages]);

  const handleCompose = useCallback(() => {
    setReplyToMessage(null);
    setComposeDialogOpen(true);
  }, []);

  const handleConfirmSuggestion = useCallback((suggestionId: string) => {
    setReviewSuggestionId(suggestionId);
  }, []);

  // Group suggestions by email
  const emailsWithSuggestions = gmailMessages.map(email => ({
    emailId: email.id,
    suggestions: emailSuggestions.filter(s => s.emailId === email.id && s.status !== 'rejected'),
  }));

  // Not connected state
  if (isConnected === false) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-4">
        <Mail className="w-8 h-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t('gmailNotConnected')}</p>
        <button
          onClick={handleConnect}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          {t('gmailConnect')}
        </button>
      </div>
    );
  }

  // Loading state
  if (isConnected === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/30 shrink-0">
        <div className="flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium">Gmail</span>
          {gmailMessages.filter(m => m.isUnread).length > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
              {gmailMessages.filter(m => m.isUnread).length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {gmailLastSyncAt && (
            <span className="text-[9px] text-muted-foreground/50">
              {new Date(gmailLastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={handleCompose}
            className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            title={t('composeEmail')}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleRefresh}
            disabled={gmailSyncing}
            className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title={t('gmailSync')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${gmailSyncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Email list */}
      <div className="flex-1 min-h-0 overflow-auto">
        {gmailMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground/60 text-sm gap-1">
            <Mail className="w-5 h-5" />
            <span>{t('noNewEmails')}</span>
          </div>
        ) : (
          emailsWithSuggestions.map(({ emailId, suggestions }) => (
            <EmailItem
              key={emailId}
              emailId={emailId}
              suggestions={suggestions}
              onConfirm={handleConfirmSuggestion}
              onReject={rejectEmailSuggestion}
              onReply={handleReply}
              onTrash={handleTrash}
              onAnalyze={handleAnalyze}
              onDirectReply={handleDirectReply}
              onMarkAsRead={handleMarkAsRead}
            />
          ))
        )}
      </div>

      {/* Reply Dialog (Brain suggestion reply) */}
      {replyDialogSuggestionId && (
        <EmailReplyDialog
          suggestionId={replyDialogSuggestionId}
          onClose={() => setReplyDialogSuggestionId(null)}
        />
      )}

      {/* Compose / Direct Reply Dialog */}
      <ComposeEmailDialog
        open={composeDialogOpen}
        onOpenChange={(open) => {
          setComposeDialogOpen(open);
          if (!open) setReplyToMessage(null);
        }}
        replyToMessage={replyToMessage ?? undefined}
      />

      {/* Brain Suggestion Review Dialog */}
      <SuggestionReviewDialog
        open={!!reviewSuggestionId}
        onOpenChange={(open) => {
          if (!open) setReviewSuggestionId(null);
        }}
        suggestion={reviewSuggestionId ? emailSuggestions.find(s => s.id === reviewSuggestionId) ?? null : null}
      />
    </div>
  );
}

export default EmailWidget;
