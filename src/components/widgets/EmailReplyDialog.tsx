/**
 * EmailReplyDialog — Modal for reviewing/editing Brain-generated reply draft.
 *
 * Shows original email context + editable reply draft.
 * User can edit before sending.
 */

import { useState, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { X, Send, Mail, Brain, Loader2 } from 'lucide-react';

interface EmailReplyDialogProps {
  suggestionId: string;
  onClose: () => void;
}

function EmailReplyDialog({ suggestionId, onClose }: EmailReplyDialogProps) {
  const { t } = useTranslation();
  const {
    emailSuggestions,
    gmailMessages,
    sendEmailReply,
    confirmEmailSuggestion,
  } = useAppStore();

  const suggestion = emailSuggestions.find(s => s.id === suggestionId);
  const email = suggestion ? gmailMessages.find(m => m.id === suggestion.emailId) : null;

  const [replyBody, setReplyBody] = useState(suggestion?.suggestedReplyDraft || '');
  const [isSending, setIsSending] = useState(false);
  const [confirmToo, setConfirmToo] = useState(true);

  const handleSend = useCallback(async () => {
    if (!suggestion || !replyBody.trim()) return;
    setIsSending(true);
    try {
      // Confirm suggestion (create event/todo/note) if checked
      if (confirmToo && suggestion.status === 'pending') {
        await confirmEmailSuggestion(suggestion.id);
      }
      // Send the reply
      await sendEmailReply(suggestion.id, replyBody);
      onClose();
    } catch (err) {
      console.error('[EmailReply] Send error:', err);
    } finally {
      setIsSending(false);
    }
  }, [suggestion, replyBody, confirmToo, confirmEmailSuggestion, sendEmailReply, onClose]);

  if (!suggestion || !email) {
    return null;
  }

  // Parse sender
  const senderMatch = email.from.match(/^(.+?)\s*</);
  const senderName = senderMatch ? senderMatch[1].trim() : email.from;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-card rounded-xl shadow-2xl border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{t('replyDraft')}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Original email context */}
        <div className="px-4 py-3 bg-muted/10 border-b space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">{senderName}</span>
            <span>·</span>
            <span className="truncate">{email.subject}</span>
          </div>
          <p className="text-[11px] text-muted-foreground/70 line-clamp-3">{email.snippet}</p>
        </div>

        {/* Brain suggestion summary */}
        {suggestion.summary && (
          <div className="px-4 py-2 border-b bg-primary/5">
            <div className="flex items-center gap-1.5 text-[10px] text-primary">
              <Brain className="w-3 h-3" />
              <span className="font-medium">Brain 분석:</span>
              <span className="text-foreground/70">{suggestion.summary}</span>
            </div>
          </div>
        )}

        {/* Editable reply body */}
        <div className="p-4">
          <textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            className="w-full h-40 text-sm p-3 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder={t('typeReply')}
          />
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
          {/* Confirm suggestion checkbox */}
          {suggestion.status === 'pending' && (suggestion.suggestedEvent || suggestion.suggestedTodo || suggestion.suggestedNote) && (
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={confirmToo}
                onChange={(e) => setConfirmToo(e.target.checked)}
                className="rounded border-muted-foreground/30"
              />
              {t('confirmSuggestionToo')}
            </label>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded-md hover:bg-muted transition-colors text-muted-foreground"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSend}
              disabled={isSending || !replyBody.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('sending')}</>
              ) : (
                <><Send className="w-3.5 h-3.5" /> {t('sendReply')}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmailReplyDialog;
