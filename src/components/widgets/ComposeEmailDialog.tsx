/**
 * ComposeEmailDialog — Shared dialog for composing new emails and replying to existing ones.
 *
 * - Compose mode (no replyToMessage): Empty To, Subject, Body fields
 * - Reply mode (with replyToMessage): Pre-fills To, Subject, shows quoted original
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil, Reply, Loader2, Send } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/stores/appStore';
import { toast } from 'sonner';
import type { GmailMessage } from '@/types/core';

interface ComposeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replyToMessage?: GmailMessage;
}

export function ComposeEmailDialog({ open, onOpenChange, replyToMessage }: ComposeEmailDialogProps) {
  const { t } = useTranslation();
  const { composeEmail, replyToEmail, syncGmail } = useAppStore();

  const isReply = !!replyToMessage;

  // Form state
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Reset form when dialog opens or replyToMessage changes
  useEffect(() => {
    if (open) {
      if (replyToMessage) {
        // Reply mode — extract email from "Name <email>" format
        const fromMatch = replyToMessage.from.match(/<(.+?)>/);
        setTo(fromMatch ? fromMatch[1] : replyToMessage.from);
        setSubject(
          replyToMessage.subject.startsWith('Re:')
            ? replyToMessage.subject
            : `Re: ${replyToMessage.subject}`
        );
        setBody('');
      } else {
        // Compose mode — clear all fields
        setTo('');
        setSubject('');
        setBody('');
      }
      setIsSending(false);
    }
  }, [open, replyToMessage]);

  const canSend = to.trim() && body.trim() && !isSending;

  const handleSend = async () => {
    if (!canSend) return;
    setIsSending(true);

    try {
      let result: { success: boolean; error?: string };

      if (isReply && replyToMessage) {
        result = await replyToEmail(replyToMessage.id, body.trim());
      } else {
        result = await composeEmail(to.trim(), subject.trim(), body.trim());
      }

      if (result.success) {
        toast.success(t('emailSent'));
        onOpenChange(false);
        // Trigger sync after short delay so sent email appears
        setTimeout(() => syncGmail(), 1500);
      } else {
        toast.error(t('emailSendFailed') + (result.error ? `: ${result.error}` : ''));
      }
    } catch {
      toast.error(t('emailSendFailed'));
    } finally {
      setIsSending(false);
    }
  };

  // Handle Ctrl/Cmd+Enter to send
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSend) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isReply ? (
              <Reply className="w-5 h-5 text-blue-500" />
            ) : (
              <Pencil className="w-5 h-5 text-primary" />
            )}
            {isReply ? t('reply') : t('composeEmail')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isReply ? t('reply') : t('composeEmail')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* To */}
          <div className="space-y-1.5">
            <Label htmlFor="email-to" className="text-xs font-medium text-muted-foreground">
              {t('to')}
            </Label>
            <Input
              id="email-to"
              type="email"
              placeholder={t('toPlaceholder')}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={isReply}
              className={isReply ? 'bg-muted/30 text-muted-foreground' : ''}
            />
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="email-subject" className="text-xs font-medium text-muted-foreground">
              {t('subject')}
            </Label>
            <Input
              id="email-subject"
              placeholder={t('subjectPlaceholder')}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label htmlFor="email-body" className="text-xs font-medium text-muted-foreground">
              {t('emailBody')}
            </Label>
            <textarea
              id="email-body"
              className="flex min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              placeholder={t('bodyPlaceholder')}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          {/* Quoted Original (Reply mode only) */}
          {isReply && replyToMessage && (
            <details className="group">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
                ── {t('originalMessage')} ──
              </summary>
              <div className="mt-2 p-3 rounded-md bg-muted/20 border border-border/50 text-xs text-muted-foreground max-h-[120px] overflow-y-auto whitespace-pre-wrap">
                <div className="mb-1 font-medium">{replyToMessage.from}</div>
                <div className="mb-1 text-[10px]">{new Date(replyToMessage.date).toLocaleString()}</div>
                <div className="border-t border-border/30 pt-1 mt-1">
                  {replyToMessage.body.slice(0, 500)}
                  {replyToMessage.body.length > 500 && '...'}
                </div>
              </div>
            </details>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSend} disabled={!canSend}>
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <Send className="w-4 h-4 mr-1" />
            )}
            {isSending ? t('sending') : t('sendReply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
