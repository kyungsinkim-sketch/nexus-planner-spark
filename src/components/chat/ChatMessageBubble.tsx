import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  Pin,
  PinOff,
  SmilePlus,
  MoreHorizontal,
  Pencil,
  MessageCircle,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import * as fileService from '@/services/fileService';
import type { ChatMessage, ChatReaction, FileItem } from '@/types/core';
import { BRAIN_BOT_USER_ID } from '@/types/core';
import { BrainActionBubble } from './BrainActionBubble';
import { PersonaResponseBubble } from './PersonaResponseBubble';
import { toggleReaction } from '@/services/chatReactionService';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

/**
 * Renders message content with @mention highlights.
 * Detects @Name patterns and wraps them in a styled <span>.
 */
function renderContentWithMentions(content: string, isCurrentUser: boolean) {
  // Match @followed-by-name (Korean/English/numbers, 1-20 chars)
  const mentionRegex = /@([\w가-힣\u3131-\u318E\u3200-\u321E\uFFA0-\uFFDC]+(?:\s[\w가-힣\u3131-\u318E\u3200-\u321E\uFFA0-\uFFDC]+)?)/g;
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    // Add highlighted mention
    parts.push(
      <span
        key={match.index}
        className={`font-semibold ${
          isCurrentUser
            ? 'text-blue-200 bg-blue-500/20'
            : 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/20'
        } rounded px-0.5`}
      >
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : content;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '👀', '✅'];

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isCurrentUser: boolean;
  onVoteDecision?: (messageId: string, optionId: string, reason: string) => void;
  onAcceptSchedule?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  onPin?: (messageId: string) => void;
  onUnpin?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
  onConfirmBrainAction?: (actionId: string) => void;
  onRejectBrainAction?: (actionId: string) => void;
  onReactionToggle?: (messageId: string, emoji: string) => void;
}

export function ChatMessageBubble({ message, isCurrentUser, onVoteDecision, onAcceptSchedule, onDelete, onEdit, onPin, onUnpin, onReply, onConfirmBrainAction, onRejectBrainAction, onReactionToggle }: ChatMessageBubbleProps) {
  const { messageType } = message;
  const { currentUser, messages: allMessages } = useAppStore();

  // For AI messages (persona_response, brain_action), check if the current user
  // was the one who triggered the AI by finding the preceding user message
  const isAiMessageCaller = (messageType === 'persona_response' || messageType === 'brain_action') && currentUser
    ? (() => {
        const msgIndex = allMessages.findIndex(m => m.id === message.id);
        if (msgIndex <= 0) return false;
        // Walk backwards to find the user message that triggered this AI response
        // Look back up to 10 messages to handle busy chat rooms
        for (let i = msgIndex - 1; i >= Math.max(0, msgIndex - 10); i--) {
          const prev = allMessages[i];
          if (prev.userId !== BRAIN_BOT_USER_ID && prev.messageType !== 'brain_action' && prev.messageType !== 'persona_response') {
            return prev.userId === currentUser.id;
          }
        }
        return false;
      })()
    : false;

  // AI Persona response message (@pablo) — wrapped with delete/pin for caller
  if (messageType === 'persona_response') {
    return (
      <AiMessageWrapper
        canManage={isAiMessageCaller}
        onDelete={onDelete}
        onPin={onPin}
        onUnpin={onUnpin}
        onReply={onReply}
        messageId={message.id}
        reactions={message.reactions}
        onReactionToggle={onReactionToggle}
      >
        <PersonaResponseBubble message={message} />
      </AiMessageWrapper>
    );
  }

  // Brain AI bot message — wrapped with delete/pin for caller
  if (messageType === 'brain_action') {
    return (
      <AiMessageWrapper
        canManage={isAiMessageCaller}
        onDelete={onDelete}
        onPin={onPin}
        onUnpin={onUnpin}
        onReply={onReply}
        messageId={message.id}
        reactions={message.reactions}
        onReactionToggle={onReactionToggle}
      >
        <BrainActionBubble
          message={message}
          onConfirmAction={onConfirmBrainAction}
          onRejectAction={onRejectBrainAction}
        />
      </AiMessageWrapper>
    );
  }

  if (messageType === 'location' && message.locationData) {
    return (
      <MessageWrapper isCurrentUser={isCurrentUser} onDelete={onDelete} onPin={onPin} onUnpin={onUnpin} onEdit={onEdit} onReply={onReply} messageId={message.id} content={message.content} reactions={message.reactions} onReactionToggle={onReactionToggle}>
        <LocationBubble data={message.locationData} isCurrentUser={isCurrentUser} />
      </MessageWrapper>
    );
  }

  if (messageType === 'schedule' && message.scheduleData) {
    return (
      <MessageWrapper isCurrentUser={isCurrentUser} onDelete={onDelete} onPin={onPin} onUnpin={onUnpin} onEdit={onEdit} onReply={onReply} messageId={message.id} content={message.content} reactions={message.reactions} onReactionToggle={onReactionToggle}>
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
      <MessageWrapper isCurrentUser={isCurrentUser} onDelete={onDelete} onPin={onPin} onUnpin={onUnpin} onEdit={onEdit} onReply={onReply} messageId={message.id} content={message.content} reactions={message.reactions} onReactionToggle={onReactionToggle}>
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
      <MessageWrapper isCurrentUser={isCurrentUser} onDelete={onDelete} onPin={onPin} onUnpin={onUnpin} onEdit={onEdit} onReply={onReply} messageId={message.id} content={message.content} reactions={message.reactions} onReactionToggle={onReactionToggle}>
        <FileBubble message={message} isCurrentUser={isCurrentUser} />
      </MessageWrapper>
    );
  }

  // Default text message (with optional reply quote)
  const replyMsg = message.replyToMessage || (message.replyToMessageId ? allMessages.find(m => m.id === message.replyToMessageId) : null);

  return (
    <MessageWrapper isCurrentUser={isCurrentUser} onDelete={onDelete} onPin={onPin} onUnpin={onUnpin} onEdit={onEdit} onReply={onReply} messageId={message.id} content={message.content} reactions={message.reactions} onReactionToggle={onReactionToggle}>
      <div className="w-fit max-w-full">
        {/* Reply quote block */}
        {replyMsg && (
          <ReplyQuote message={replyMsg} isCurrentUser={isCurrentUser} />
        )}
        <div
          className={`w-fit rounded-2xl px-4 py-2 text-sm max-w-full whitespace-pre-wrap ${
            isCurrentUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground'
          } ${replyMsg ? 'rounded-tl-md' : ''}`}
          style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
        >
          {renderContentWithMentions(message.content, isCurrentUser)}
        </div>
      </div>
    </MessageWrapper>
  );
}

// Reaction display bar with consistent styling
function ReactionBar({ reactions, messageId, onToggle }: {
  reactions?: ChatReaction[];
  messageId: string;
  onToggle?: (messageId: string, emoji: string) => void;
}) {
  const { currentUser, getUserById } = useAppStore();
  if (!reactions || reactions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {reactions.map((r) => {
        const isMine = currentUser ? r.userIds.includes(currentUser.id) : false;
        const reactUsers = r.userIds.map(id => getUserById(id)).filter(Boolean);
        return (
          <button
            key={r.emoji}
            onClick={() => onToggle?.(messageId, r.emoji)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all border ${
              isMine
                ? 'bg-gray-100 dark:bg-zinc-700/50 border-primary/30 text-primary'
                : 'bg-gray-50 dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700 text-muted-foreground'
            }`}
          >
            <span className="text-base leading-none" style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' }}>{r.emoji}</span>
            <div className="flex -space-x-1">
              {reactUsers.slice(0, 3).map((user) => (
                user?.avatar ? (
                  <img key={user.id} src={user.avatar} alt={user.name} title={user.name}
                    className="w-3.5 h-3.5 rounded-full border border-background object-cover" />
                ) : (
                  <div key={user?.id} title={user?.name}
                    className="w-3.5 h-3.5 rounded-full border border-background bg-muted flex items-center justify-center text-[7px] font-medium">
                    {user?.name?.charAt(0)?.toUpperCase()}
                  </div>
                )
              ))}
              {reactUsers.length > 3 && (
                <div className="w-3.5 h-3.5 rounded-full border border-background bg-muted flex items-center justify-center text-[6px]">
                  +{reactUsers.length - 3}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Reply quote block — shows the quoted message above a reply; click scrolls to original
function ReplyQuote({ message: replyMsg, isCurrentUser }: { message: ChatMessage; isCurrentUser: boolean }) {
  const { getUserById } = useAppStore();
  const sender = getUserById(replyMsg.userId);

  const scrollToOriginal = () => {
    const el = document.querySelector(`[data-message-id="${replyMsg.id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-primary/50', 'rounded-xl');
      setTimeout(() => el.classList.remove('ring-2', 'ring-primary/50', 'rounded-xl'), 1500);
    }
  };

  return (
    <div
      onClick={scrollToOriginal}
      className={`flex items-start gap-1.5 mb-0.5 px-3 py-1.5 rounded-t-xl text-[11px] cursor-pointer hover:opacity-80 transition-opacity ${
        isCurrentUser ? 'bg-primary/40 text-primary-foreground' : 'bg-muted text-foreground/70'
      }`}
    >
      <div className="w-0.5 min-h-[16px] bg-primary/70 rounded-full shrink-0 mt-0.5" />
      <div className="min-w-0">
        <span className="font-semibold text-[10px]">{sender?.name || '알 수 없음'}</span>
        <p className="truncate max-w-[200px]">{replyMsg.content}</p>
      </div>
    </div>
  );
}

// Quick emoji picker (appears on hover)
function EmojiPicker({ messageId, onToggle }: {
  messageId: string;
  onToggle?: (messageId: string, emoji: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  if (!onToggle) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="p-0.5 rounded opacity-0 group-hover/msg:opacity-100 hover:bg-muted transition-all"
        title="Add reaction"
      >
        <SmilePlus className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      {showPicker && (
        <div className="absolute bottom-7 left-0 z-20 flex gap-1 p-1.5 rounded-xl bg-popover/95 backdrop-blur-md border shadow-lg">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => { onToggle(messageId, emoji); setShowPicker(false); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-base"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Slack-style hover action bar — appears top-right on hover.
 * Shows: emoji picker, reply, more menu (edit/pin/unpin/delete).
 */
function HoverActionBar({ messageId, content, canEdit, canDelete, canPin, isCurrentUser, onReactionToggle, onEdit, onDelete, onPin, onUnpin, onReply }: {
  messageId: string;
  content?: string;
  canEdit: boolean;
  canDelete: boolean;
  canPin: boolean;
  isCurrentUser?: boolean;
  onReactionToggle?: (messageId: string, emoji: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onUnpin?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiPos, setEmojiPos] = useState<{ top: number; left: number } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const emojiRef = useRef<HTMLButtonElement>(null);
  const [editText, setEditText] = useState('');

  const startEdit = () => {
    setEditText(content || '');
    setIsEditing(true);
    setShowMenu(false);
  };

  const submitEdit = () => {
    if (editText.trim() && onEdit) {
      onEdit(messageId, editText.trim());
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 mt-1">
        <input
          type="text" value={editText} onChange={e => setEditText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submitEdit(); if (e.key === 'Escape') setIsEditing(false); }}
          className="flex-1 text-sm bg-muted/30 border border-border/50 rounded px-2 py-0.5 focus:outline-none"
          autoFocus
        />
        <button onClick={submitEdit} className="p-0.5 hover:bg-green-500/20 rounded"><Check className="w-3.5 h-3.5 text-green-400" /></button>
        <button onClick={() => setIsEditing(false)} className="p-0.5 hover:bg-red-500/20 rounded"><X className="w-3.5 h-3.5 text-red-400" /></button>
      </div>
    );
  }

  return (
    <>
      {/* Floating action bar — for own messages: bottom-right; for others: right side vertically centered */}
      <div className={`absolute flex items-center rounded-lg shadow-md z-20 transition-opacity bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 ${
        isCurrentUser ? '-bottom-4 right-0' : 'top-1/2 -translate-y-1/2 -right-1 translate-x-full'
      } ${showMenu || showEmoji ? 'opacity-100' : 'opacity-0 group-hover/msg:opacity-100'}`}
      >
        {/* Emoji */}
        <button ref={emojiRef} onClick={(e) => {
            e.stopPropagation();
            if (!showEmoji && emojiRef.current) {
              const r = emojiRef.current.getBoundingClientRect();
              setEmojiPos({ top: r.bottom + 2, left: Math.max(8, r.left) });
            }
            setShowEmoji(!showEmoji); setShowMenu(false);
          }}
          className="p-1.5 rounded-l-lg hover:bg-muted/60 transition-colors" title="리액션">
          <SmilePlus className="w-3.5 h-3.5 text-muted-foreground" />
        </button>

        {/* Reply */}
        {onReply && (
          <button onClick={() => { onReply(messageId); setShowEmoji(false); setShowMenu(false); }}
            className="p-1.5 hover:bg-muted/60 transition-colors" title="답글">
            <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}

        {/* More menu trigger */}
        {(canEdit || canDelete || canPin) && (
          <button ref={moreRef} onClick={(e) => {
              e.stopPropagation();
              if (!showMenu && moreRef.current) {
                const r = moreRef.current.getBoundingClientRect();
                setMenuPos({ top: r.bottom + 2, left: r.right });
              }
              setShowMenu(!showMenu); setShowEmoji(false);
            }}
            className="p-1.5 rounded-r-lg hover:bg-muted/60 transition-colors" title="더보기">
            <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Emoji picker — Portal to body */}
      {showEmoji && emojiPos && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setShowEmoji(false)} />
          <div className="fixed z-[9999] flex items-center gap-0.5 rounded-lg px-1.5 py-1 bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.15)]"
            style={{ top: emojiPos.top, left: emojiPos.left }}
            onClick={e => e.stopPropagation()}>
            {QUICK_EMOJIS.map(emoji => (
              <button key={emoji} onClick={() => { onReactionToggle?.(messageId, emoji); setShowEmoji(false); }}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors text-xs">{emoji}</button>
            ))}
          </div>
        </>,
        document.body
      )}

      {/* Context menu — Portal to body */}
      {showMenu && menuPos && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setShowMenu(false)} />
          <div className="fixed z-[9999] rounded-lg py-0.5 min-w-[100px] whitespace-nowrap bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.15)]"
            style={{ top: menuPos.top, left: menuPos.left, transform: 'translateX(-100%)' }}
            onClick={e => e.stopPropagation()}>
            {canEdit && onEdit && (
              <button onClick={startEdit}
                className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors">
                <Pencil className="w-3 h-3 shrink-0 text-gray-500 dark:text-gray-400" /> 수정
              </button>
            )}
            {canPin && onPin && (
              <button onClick={() => { onPin(messageId); setShowMenu(false); }}
                className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors">
                <Pin className="w-3 h-3 shrink-0 text-gray-500 dark:text-gray-400" /> 고정
              </button>
            )}
            {canPin && onUnpin && (
              <button onClick={() => { onUnpin(messageId); setShowMenu(false); }}
                className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors">
                <PinOff className="w-3 h-3 shrink-0 text-gray-500 dark:text-gray-400" /> 고정 해제
              </button>
            )}
            {canDelete && onDelete && (
              <>
                <div className="border-t border-gray-100 dark:border-zinc-700 my-1" />
                <button onClick={() => { onDelete(messageId); setShowMenu(false); }}
                  className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                  <Trash2 className="w-3 h-3 shrink-0" /> 삭제
                </button>
              </>
            )}
          </div>
        </>,
        document.body
      )}
    </>
  );
}

// Wrapper that adds Slack-style hover actions
function MessageWrapper({ children, isCurrentUser, onDelete, onEdit, onPin, onUnpin, onReply, messageId, content, reactions, onReactionToggle }: {
  children: React.ReactNode;
  isCurrentUser: boolean;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  onPin?: (messageId: string) => void;
  onUnpin?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
  messageId: string;
  content?: string;
  reactions?: ChatReaction[];
  onReactionToggle?: (messageId: string, emoji: string) => void;
}) {
  return (
    <div className={`group/msg relative max-w-[85%] overflow-visible ${isCurrentUser ? 'ml-auto' : ''}`}>
      {children}
      <ReactionBar reactions={reactions} messageId={messageId} onToggle={onReactionToggle} />
      <HoverActionBar
        messageId={messageId}
        content={content}
        canEdit={isCurrentUser}
        canDelete={isCurrentUser}
        canPin={isCurrentUser}
        isCurrentUser={isCurrentUser}
        onReactionToggle={onReactionToggle}
        onEdit={onEdit}
        onDelete={onDelete}
        onPin={onPin}
        onUnpin={onUnpin}
        onReply={onReply}
      />
    </div>
  );
}

// Wrapper for AI messages (persona + brain) that adds actions for the caller
function AiMessageWrapper({ children, canManage, onDelete, onPin, onUnpin, onReply, messageId, reactions, onReactionToggle }: {
  children: React.ReactNode;
  canManage: boolean;
  onDelete?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onUnpin?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
  messageId: string;
  reactions?: ChatReaction[];
  onReactionToggle?: (messageId: string, emoji: string) => void;
}) {
  return (
    <div className="group/msg relative max-w-full overflow-visible">
      {children}
      <ReactionBar reactions={reactions} messageId={messageId} onToggle={onReactionToggle} />
      <HoverActionBar
        messageId={messageId}
        canEdit={false}
        canDelete={canManage}
        canPin={canManage}
        isCurrentUser={false}
        onReactionToggle={onReactionToggle}
        onDelete={onDelete}
        onPin={onPin}
        onUnpin={onUnpin}
        onReply={onReply}
      />
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

  // If not in store, fetch from DB (use maybeSingle to avoid 406 when row doesn't exist)
  useEffect(() => {
    if (message.attachmentId && !storeFileItem && isSupabaseConfigured()) {
      supabase
        .from('file_items')
        .select('*')
        .eq('id', message.attachmentId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            // Silently ignore — file may have been deleted or is a mock-only ID
            console.debug(`[FileBubble] Could not fetch file_item ${message.attachmentId}:`, error.message);
            return;
          }
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

      {/* File Preview Dialog — same style as FilesWidget */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-[90vw] w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              {getFileIcon()}
              {fileName}
            </DialogTitle>
            <DialogDescription className="sr-only">{fileName}</DialogDescription>
          </DialogHeader>

          {/* Preview area */}
          <div className="bg-muted rounded-lg flex items-center justify-center min-h-[120px] overflow-hidden">
            {isImage && downloadUrl ? (
              <img src={downloadUrl} alt={fileName} className="max-w-full max-h-[55vh] object-contain mx-auto" loading="lazy" />
            ) : isPdf && downloadUrl ? (
              <div className="w-full h-[60vh]">
                <iframe src={`${downloadUrl}#toolbar=0`} className="w-full h-full border-0" title={fileName} />
              </div>
            ) : (
              <div className="text-center space-y-2 p-6">
                {getFileIcon()}
                <p className="text-xs text-muted-foreground">{fileExt.toUpperCase()} file</p>
              </div>
            )}
          </div>

          {/* File metadata */}
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Type</span>
              <span className="font-medium text-foreground">{fileExt.toUpperCase()}</span>
            </div>
            {fileSize && (
              <div className="flex justify-between">
                <span>Size</span>
                <span className="font-medium text-foreground">{fileSize}</span>
              </div>
            )}
            {fileItem?.createdAt && (
              <div className="flex justify-between">
                <span>Uploaded</span>
                <span className="font-medium text-foreground">
                  {new Date(fileItem.createdAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          <Separator />

          {/* Download button */}
          {downloadUrl && (
            <Button variant="outline" className="w-full gap-2" onClick={handleDownload}>
              <Download className="w-4 h-4" />
              Download
            </Button>
          )}
        </DialogContent>
      </Dialog>
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
