import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  MapPin,
  ExternalLink,
  CalendarDays,
  Clock,
  Users,
  ListChecks,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Download,
  Image as ImageIcon,
  FileType,
  Eye,
  X,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import * as fileService from '@/services/fileService';
import type { ChatMessage, FileItem } from '@/types/core';
import { BrainActionBubble } from './BrainActionBubble';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isCurrentUser: boolean;
  onVoteDecision?: (messageId: string, optionId: string, reason: string) => void;
  onAcceptSchedule?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onConfirmBrainAction?: (actionId: string) => void;
  onRejectBrainAction?: (actionId: string) => void;
}

export function ChatMessageBubble({ message, isCurrentUser, onVoteDecision, onAcceptSchedule, onDelete, onConfirmBrainAction, onRejectBrainAction }: ChatMessageBubbleProps) {
  const { messageType } = message;

  // Brain AI bot message
  if (messageType === 'brain_action') {
    return (
      <BrainActionBubble
        message={message}
        onConfirmAction={onConfirmBrainAction}
        onRejectAction={onRejectBrainAction}
      />
    );
  }

  if (messageType === 'location' && message.locationData) {
    return (
      <MessageWrapper isCurrentUser={isCurrentUser} onDelete={onDelete} messageId={message.id}>
        <LocationBubble data={message.locationData} isCurrentUser={isCurrentUser} />
      </MessageWrapper>
    );
  }

  if (messageType === 'schedule' && message.scheduleData) {
    return (
      <MessageWrapper isCurrentUser={isCurrentUser} onDelete={onDelete} messageId={message.id}>
        <ScheduleBubble
          data={message.scheduleData}
          isCurrentUser={isCurrentUser}
          onAccept={() => onAcceptSchedule?.(message.id)}
        />
      </MessageWrapper>
    );
  }

  if (messageType === 'decision' && message.decisionData) {
    return (
      <MessageWrapper isCurrentUser={isCurrentUser} onDelete={onDelete} messageId={message.id}>
        <DecisionBubble
          data={message.decisionData}
          messageId={message.id}
          isCurrentUser={isCurrentUser}
          onVote={(optionId, reason) => onVoteDecision?.(message.id, optionId, reason)}
        />
      </MessageWrapper>
    );
  }

  if (messageType === 'file') {
    return (
      <MessageWrapper isCurrentUser={isCurrentUser} onDelete={onDelete} messageId={message.id}>
        <FileBubble message={message} isCurrentUser={isCurrentUser} />
      </MessageWrapper>
    );
  }

  // Default text message
  return (
    <MessageWrapper isCurrentUser={isCurrentUser} onDelete={onDelete} messageId={message.id}>
      <div
        className={`inline-block rounded-2xl px-4 py-2 text-sm ${
          isCurrentUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        }`}
      >
        {message.content}
      </div>
    </MessageWrapper>
  );
}

// Wrapper that adds hover delete button
function MessageWrapper({ children, isCurrentUser, onDelete, messageId }: {
  children: React.ReactNode;
  isCurrentUser: boolean;
  onDelete?: (messageId: string) => void;
  messageId: string;
}) {
  if (!isCurrentUser || !onDelete) return <>{children}</>;

  return (
    <div className="group/msg relative inline-block">
      {children}
      <button
        onClick={() => onDelete(messageId)}
        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/msg:opacity-100 transition-opacity shadow-sm hover:bg-destructive/90"
        title="Delete message"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

// Location bubble with map preview
function LocationBubble({ data, isCurrentUser }: { data: NonNullable<ChatMessage['locationData']>; isCurrentUser: boolean }) {
  const { t } = useTranslation();
  const providerLabel = { google: 'Google Maps', naver: 'Naver Map', kakao: 'Kakao Map', other: 'Map' }[data.provider];

  return (
    <div className={`rounded-2xl overflow-hidden border max-w-[min(320px,100%)] ${isCurrentUser ? 'bg-primary/5 border-primary/20' : 'bg-muted border-border'}`}>
      <div className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-sm">{data.title}</p>
            {data.address && <p className="text-xs text-muted-foreground mt-0.5">{data.address}</p>}
          </div>
        </div>
        <a
          href={data.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          {t('openInMap').replace('{provider}', providerLabel)}
        </a>
      </div>
      {/* Map preview iframe */}
      {data.provider === 'google' && data.url.includes('google') && (
        <div className="h-32 bg-muted border-t">
          <iframe
            src={`https://maps.google.com/maps?q=${encodeURIComponent(data.address || data.title)}&output=embed`}
            className="w-full h-full border-0"
            loading="lazy"
            title="Map preview"
          />
        </div>
      )}
      {data.provider !== 'google' && (
        <div className="h-20 bg-gradient-to-b from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 border-t flex items-center justify-center">
          <Badge variant="secondary" className="text-xs">{providerLabel}</Badge>
        </div>
      )}
    </div>
  );
}

// Schedule bubble with accept button
function ScheduleBubble({ data, isCurrentUser, onAccept }: {
  data: NonNullable<ChatMessage['scheduleData']>;
  isCurrentUser: boolean;
  onAccept: () => void;
}) {
  const { getUserById } = useAppStore();
  const { t } = useTranslation();
  const startDate = new Date(data.startAt);
  const endDate = new Date(data.endAt);

  const formatDate = (d: Date) => d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' });
  const formatTime = (d: Date) => d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`rounded-2xl overflow-hidden border max-w-[min(320px,100%)] ${isCurrentUser ? 'bg-primary/5 border-primary/20' : 'bg-muted border-border'}`}>
      <div className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <CalendarDays className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
          <p className="font-medium text-sm">{data.title}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{formatDate(startDate)} {formatTime(startDate)} ~ {formatTime(endDate)}</span>
        </div>
        {data.location && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span>{data.location}</span>
          </div>
        )}
        {data.description && (
          <p className="text-xs text-muted-foreground">{data.description}</p>
        )}
        {data.inviteeIds.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="w-3 h-3" />
            <span>
              {data.inviteeIds.map(id => getUserById(id)?.name).filter(Boolean).join(', ')}
            </span>
          </div>
        )}
        {!isCurrentUser && (
          <Button size="sm" variant="outline" className="w-full text-xs mt-1 gap-1" onClick={onAccept}>
            <CalendarDays className="w-3 h-3" />
            {t('addToCalendar')}
          </Button>
        )}
      </div>
    </div>
  );
}

// File bubble with download and preview
function FileBubble({ message, isCurrentUser }: { message: ChatMessage; isCurrentUser: boolean }) {
  const { files } = useAppStore();
  const [showPreview, setShowPreview] = useState(false);
  const [dbFileItem, setDbFileItem] = useState<FileItem | null>(null);

  // Extract filename from message content "📎 Uploaded file: filename.ext"
  const fileNameFromContent = message.content.replace(/^📎\s*Uploaded file:\s*/i, '').trim();

  // Find the actual file item: first from store, then from DB lookup
  const storeFileItem = message.attachmentId ? files.find(f => f.id === message.attachmentId) : null;
  const fileItem = storeFileItem || dbFileItem;

  // If not in store, fetch from DB
  useEffect(() => {
    if (message.attachmentId && !storeFileItem && isSupabaseConfigured()) {
      supabase
        .from('file_items')
        .select('*')
        .eq('id', message.attachmentId)
        .single()
        .then(({ data }) => {
          if (data) {
            setDbFileItem({
              id: data.id,
              fileGroupId: data.file_group_id,
              name: data.name,
              uploadedBy: data.uploaded_by,
              createdAt: data.created_at,
              size: data.size || undefined,
              type: data.type || undefined,
              isImportant: data.is_important || false,
              source: (data.source as 'UPLOAD' | 'CHAT') || 'UPLOAD',
              comment: data.comment || undefined,
              storagePath: data.storage_path || undefined,
            });
          }
        });
    }
  }, [message.attachmentId, storeFileItem]);

  const fileName = fileItem?.name || fileNameFromContent || 'Unknown file';
  const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
  const fileSize = fileItem?.size;

  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(fileExt);
  const isPdf = fileExt === 'pdf';
  const isPreviewable = isImage || isPdf;

  const downloadUrl = fileItem?.storagePath ? fileService.getFileDownloadUrl(fileItem.storagePath) : null;

  const handleDownload = async () => {
    if (!downloadUrl) return;
    try {
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback to opening in new tab
      window.open(downloadUrl, '_blank');
    }
  };

  const getFileIcon = () => {
    if (isImage) return <ImageIcon className="w-5 h-5 text-green-500" />;
    if (isPdf) return <FileType className="w-5 h-5 text-red-500" />;
    return <FileText className="w-5 h-5 text-blue-500" />;
  };

  return (
    <>
      <div className={`rounded-2xl overflow-hidden border max-w-full w-full ${isCurrentUser ? 'bg-primary/5 border-primary/20' : 'bg-muted border-border'}`} style={{ maxWidth: 'min(320px, 100%)' }}>
        {/* Image preview thumbnail */}
        {isImage && downloadUrl && (
          <div
            className="w-full max-h-48 overflow-hidden cursor-pointer bg-black/5"
            onClick={() => setShowPreview(true)}
          >
            <img
              src={downloadUrl}
              alt={fileName}
              className="w-full h-full object-cover hover:opacity-90 transition-opacity"
              loading="lazy"
            />
          </div>
        )}

        <div className="p-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0">
              {getFileIcon()}
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-sm font-medium truncate">{fileName}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {fileSize && <span>{fileSize}</span>}
                <span className="uppercase">{fileExt}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2">
            {downloadUrl && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs gap-1.5 min-w-0"
                onClick={handleDownload}
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Download</span>
              </Button>
            )}
            {isPreviewable && downloadUrl && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs gap-1.5 min-w-0"
                onClick={() => setShowPreview(true)}
              >
                <Eye className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Preview</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Full-screen preview modal */}
      {showPreview && downloadUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowPreview(false)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
            onClick={() => setShowPreview(false)}
          >
            <X className="w-6 h-6" />
          </Button>
          <div
            className="max-w-[90vw] max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {isImage && (
              <img src={downloadUrl} alt={fileName} className="max-w-full max-h-[85vh] object-contain rounded-lg" />
            )}
            {isPdf && (
              <iframe
                src={downloadUrl}
                className="w-[80vw] h-[85vh] rounded-lg bg-white"
                title={`Preview: ${fileName}`}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Decision bubble with voting
function DecisionBubble({ data, messageId, isCurrentUser, onVote }: {
  data: NonNullable<ChatMessage['decisionData']>;
  messageId: string;
  isCurrentUser: boolean;
  onVote: (optionId: string, reason: string) => void;
}) {
  const { currentUser, getUserById } = useAppStore();
  const { t } = useTranslation();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [expanded, setExpanded] = useState(false);

  const myVote = data.votes.find(v => v.userId === currentUser?.id);
  const isClosed = data.status === 'closed';

  const handleVote = () => {
    if (!selectedOption || !reason.trim()) return;
    onVote(selectedOption, reason.trim());
    setSelectedOption(null);
    setReason('');
  };

  return (
    <div className={`rounded-2xl overflow-hidden border max-w-[min(360px,100%)] ${isCurrentUser ? 'bg-primary/5 border-primary/20' : 'bg-muted border-border'}`}>
      <div className="p-3 space-y-3">
        <div className="flex items-start gap-2">
          <ListChecks className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">{data.title}</p>
            {data.description && <p className="text-xs text-muted-foreground mt-0.5">{data.description}</p>}
          </div>
        </div>

        {isClosed && (
          <Badge variant="secondary" className="text-xs">{t('decisionClosed')}</Badge>
        )}

        {/* Options */}
        <div className="space-y-2">
          {data.options.map((option) => {
            const optionVotes = data.votes.filter(v => v.optionId === option.id);
            const isSelected = data.selectedOptionId === option.id;
            const isMyVote = myVote?.optionId === option.id;

            return (
              <div key={option.id} className={`rounded-lg border p-2.5 transition-colors ${
                isSelected ? 'border-green-500 bg-green-50 dark:bg-green-950/20' :
                selectedOption === option.id ? 'border-primary bg-primary/5' : 'border-border'
              }`}>
                <div
                  className={`flex items-center justify-between ${!myVote && !isClosed ? 'cursor-pointer' : ''}`}
                  onClick={() => { if (!myVote && !isClosed) setSelectedOption(option.id); }}
                >
                  <div className="flex items-center gap-2">
                    {isSelected && <Check className="w-4 h-4 text-green-500" />}
                    <span className="text-sm font-medium">{option.title}</span>
                    {isMyVote && <Badge variant="outline" className="text-[10px]">{t('myChoice')}</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground">{optionVotes.length}{t('votesUnit')}</span>
                </div>
                {option.description && (
                  <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                )}

                {/* Show votes for this option */}
                {optionVotes.length > 0 && expanded && (
                  <div className="mt-2 space-y-1.5 border-t pt-2">
                    {optionVotes.map(vote => (
                      <div key={vote.userId} className="text-xs">
                        <span className="font-medium">{getUserById(vote.userId)?.name}</span>
                        <span className="text-muted-foreground ml-1">: {vote.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Vote reason input */}
        {selectedOption && !myVote && !isClosed && (
          <div className="space-y-2">
            <Input
              placeholder={t('enterVoteReason')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVote()}
            />
            <Button size="sm" className="w-full text-xs" onClick={handleVote} disabled={!reason.trim()}>
              {t('submitVote')}
            </Button>
          </div>
        )}

        {/* Toggle votes visibility */}
        {data.votes.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground gap-1"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? t('collapseVotes') : t('viewVotes').replace('{count}', String(data.votes.length))}
          </Button>
        )}
      </div>
    </div>
  );
}
