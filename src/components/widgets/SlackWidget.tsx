/**
 * SlackWidget — Full-featured Slack client widget for Re-Be.
 *
 * Features:
 * - OAuth connect/disconnect
 * - Channel list with search
 * - Message history with user avatars
 * - Send/edit/delete messages
 * - Emoji reactions (add/remove)
 * - Thread view
 * - Pin/unpin messages
 * - Optimistic updates for instant UI feedback
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Hash, Lock, MessageSquare, Send, ExternalLink, Loader2,
  ChevronLeft, Users, Plug, Unplug, RefreshCw,
  Smile, MoreHorizontal, Trash2, Pencil, Pin, PinOff,
  MessageCircle, X, Check, Sparkles, ListChecks, CalendarPlus, Star,
} from 'lucide-react';
import {
  getSlackAuthUrl, exchangeSlackCode, getSlackStatus, getSlackChannels,
  getSlackMessages, sendSlackMessage, editSlackMessage, deleteSlackMessage,
  addSlackReaction, removeSlackReaction, pinSlackMessage, unpinSlackMessage,
  getSlackThread, disconnectSlack, formatSlackText,
  type SlackChannel, type SlackMessage, type SlackUserInfo, type SlackStatus,
} from '@/services/slackService';
import type { WidgetDataContext } from '@/types/widget';

const SLACK_REDIRECT_URI = `${window.location.origin}/integrations/slack/callback`;

// Common emoji shortcuts for quick reactions
const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '👀', '✅'];
const EMOJI_TO_SLACK: Record<string, string> = {
  '👍': 'thumbsup', '❤️': 'heart', '😂': 'laughing', '🎉': 'tada', '👀': 'eyes', '✅': 'white_check_mark',
  '👎': 'thumbsdown', '🔥': 'fire', '💯': '100', '🙏': 'pray', '😢': 'cry', '🤔': 'thinking_face',
};
const SLACK_TO_EMOJI: Record<string, string> = Object.fromEntries(
  Object.entries(EMOJI_TO_SLACK).map(([k, v]) => [v, k])
);

function SlackWidget({ context }: { context: WidgetDataContext }) {
  const { t } = useTranslation();
  const { currentUser } = useAppStore();
  const userId = currentUser?.id;

  // Connection
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Channels
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<SlackChannel | null>(null);
  const [channelSearch, setChannelSearch] = useState('');

  // Messages
  const [messages, setMessages] = useState<SlackMessage[]>([]);
  const [userMap, setUserMap] = useState<Record<string, SlackUserInfo>>({});
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Thread
  const [threadMessages, setThreadMessages] = useState<SlackMessage[]>([]);
  const [threadParentTs, setThreadParentTs] = useState<string | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);

  // Send / Edit
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [editingMsg, setEditingMsg] = useState<SlackMessage | null>(null);
  const [editText, setEditText] = useState('');

  // UI state
  const [activeMenu, setActiveMenu] = useState<string | null>(null); // ts of message showing menu
  const [emojiPickerTs, setEmojiPickerTs] = useState<string | null>(null);
  const [brainMenuTs, setBrainMenuTs] = useState<string | null>(null); // ts of message showing brain menu
  const [brainProcessing, setBrainProcessing] = useState<string | null>(null); // ts of message being analyzed

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);
  const processedCodeRef = useRef<string | null>(null);

  // ─── Check connection on mount ───
  useEffect(() => {
    if (!userId) return;
    checkStatus();
  }, [userId]);

  // ─── Handle OAuth callback ───
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'slack-oauth-callback' && event.data?.code) {
        if (processedCodeRef.current === event.data.code) return;
        processedCodeRef.current = event.data.code;
        setLoading(true);
        setError(null);
        try {
          const result = await exchangeSlackCode(event.data.code, SLACK_REDIRECT_URI, userId!);
          if (result.success) await checkStatus();
          else setError(result.error || 'OAuth failed');
        } catch (e) { setError((e as Error).message); }
        finally { setLoading(false); }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [userId]);

  const checkStatus = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const s = await getSlackStatus(userId);
      setStatus(s);
      if (s.connected) await loadChannels();
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [userId]);

  const loadChannels = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await getSlackChannels(userId);
      const sorted = data.channels.sort((a: SlackChannel, b: SlackChannel) => {
        if (a.is_channel && !b.is_channel) return -1;
        if (!a.is_channel && b.is_channel) return 1;
        if (a.is_im && !b.is_im) return 1;
        if (!a.is_im && b.is_im) return -1;
        return (a.name || '').localeCompare(b.name || '');
      });
      setChannels(sorted);
    } catch (e) { console.error('[SlackWidget] channels:', e); }
  }, [userId]);

  const userMapCacheRef = useRef<Record<string, SlackUserInfo>>({});

  const loadMessages = useCallback(async (channel: SlackChannel) => {
    if (!userId) return;
    setMessagesLoading(true);
    try {
      const data = await getSlackMessages(userId, channel.id);
      setMessages([...(data.messages || [])].reverse());
      // Merge into cache
      const newMap = { ...userMapCacheRef.current, ...(data.userMap || {}) };
      userMapCacheRef.current = newMap;
      setUserMap(newMap);
    } catch (e) { console.error('[SlackWidget] messages:', e); }
    finally { setMessagesLoading(false); }
  }, [userId]);

  const handleSelectChannel = useCallback((channel: SlackChannel) => {
    setSelectedChannel(channel);
    setThreadParentTs(null);
    setThreadMessages([]);
    loadMessages(channel);
  }, [loadMessages]);

  // ─── Scroll to bottom on new messages ───
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, threadMessages]);

  // ─── Realtime: auto-refresh on new Slack webhook messages ───
  useEffect(() => {
    if (!selectedChannel || !status?.teamId) return;

    const channel = supabase
      .channel(`slack-msgs-${selectedChannel.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'slack_messages',
          filter: `channel_id=eq.${selectedChannel.id}`,
        },
        () => {
          // New/edited/deleted message from webhook — reload from Slack API
          if (selectedChannel) {
            loadMessages(selectedChannel);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChannel, status?.teamId, loadMessages]);

  // ─── Send message (optimistic) ───
  const handleSend = useCallback(async () => {
    if (!userId || !selectedChannel || !messageText.trim() || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    const text = messageText.trim();
    setMessageText('');

    // Optimistic: add message to UI immediately
    const optimisticMsg: SlackMessage = {
      type: 'message', user: 'me', text, ts: `optimistic-${Date.now()}`,
      thread_ts: threadParentTs || undefined,
    };
    const targetList = threadParentTs ? setThreadMessages : setMessages;
    targetList(prev => [...prev, optimisticMsg]);

    try {
      const threadTs = threadParentTs || undefined;
      await sendSlackMessage(userId, selectedChannel.id, text, threadTs);
      // Background reload — don't await to keep UI snappy
      if (threadParentTs) {
        loadThread(selectedChannel.id, threadParentTs);
      } else {
        loadMessages(selectedChannel);
      }
    } catch (e) {
      console.error('[SlackWidget] send:', e);
      setMessageText(text);
      targetList(prev => prev.filter(m => m.ts !== optimisticMsg.ts));
    } finally {
      setSending(false);
      sendingRef.current = false;
    }
  }, [userId, selectedChannel, messageText, threadParentTs]);

  // ─── Edit message ───
  const handleEdit = useCallback(async () => {
    if (!userId || !selectedChannel || !editingMsg || !editText.trim()) return;
    const newText = editText.trim();
    // Optimistic
    setMessages(prev => prev.map(m => m.ts === editingMsg.ts ? { ...m, text: newText } : m));
    setEditingMsg(null);
    setEditText('');
    try {
      await editSlackMessage(userId, selectedChannel.id, editingMsg.ts, newText);
    } catch (e) {
      console.error('[SlackWidget] edit:', e);
      await loadMessages(selectedChannel);
    }
  }, [userId, selectedChannel, editingMsg, editText]);

  // ─── Delete message ───
  const handleDelete = useCallback(async (msg: SlackMessage) => {
    if (!userId || !selectedChannel) return;
    // Optimistic
    setMessages(prev => prev.filter(m => m.ts !== msg.ts));
    setActiveMenu(null);
    try {
      await deleteSlackMessage(userId, selectedChannel.id, msg.ts);
    } catch (e) {
      console.error('[SlackWidget] delete:', e);
      await loadMessages(selectedChannel);
    }
  }, [userId, selectedChannel]);

  // ─── Reactions ───
  const handleReaction = useCallback(async (msg: SlackMessage, emoji: string) => {
    if (!userId || !selectedChannel) return;
    const slackEmoji = EMOJI_TO_SLACK[emoji] || emoji;
    setEmojiPickerTs(null);
    setActiveMenu(null);

    // Check if already reacted (toggle)
    const existing = msg.reactions?.find(r => r.name === slackEmoji);
    const alreadyReacted = existing?.users?.includes(userId);

    // Optimistic update
    setMessages(prev => prev.map(m => {
      if (m.ts !== msg.ts) return m;
      const reactions = [...(m.reactions || [])];
      if (alreadyReacted) {
        const idx = reactions.findIndex(r => r.name === slackEmoji);
        if (idx >= 0) {
          reactions[idx] = { ...reactions[idx], count: reactions[idx].count - 1, users: reactions[idx].users.filter(u => u !== userId) };
          if (reactions[idx].count <= 0) reactions.splice(idx, 1);
        }
      } else {
        const idx = reactions.findIndex(r => r.name === slackEmoji);
        if (idx >= 0) {
          reactions[idx] = { ...reactions[idx], count: reactions[idx].count + 1, users: [...reactions[idx].users, userId] };
        } else {
          reactions.push({ name: slackEmoji, count: 1, users: [userId] });
        }
      }
      return { ...m, reactions };
    }));

    try {
      if (alreadyReacted) {
        await removeSlackReaction(userId, selectedChannel.id, msg.ts, slackEmoji);
      } else {
        await addSlackReaction(userId, selectedChannel.id, msg.ts, slackEmoji);
      }
    } catch (e) {
      console.error('[SlackWidget] reaction:', e);
      await loadMessages(selectedChannel);
    }
  }, [userId, selectedChannel]);

  // ─── Pin/Unpin ───
  const handlePin = useCallback(async (msg: SlackMessage, pin: boolean) => {
    if (!userId || !selectedChannel) return;
    setActiveMenu(null);
    try {
      if (pin) await pinSlackMessage(userId, selectedChannel.id, msg.ts);
      else await unpinSlackMessage(userId, selectedChannel.id, msg.ts);
      await loadMessages(selectedChannel);
    } catch (e) { console.error('[SlackWidget] pin:', e); }
  }, [userId, selectedChannel]);

  // ─── Brain AI Action ───
  const handleBrainAction = useCallback(async (msg: SlackMessage, actionType: 'todo' | 'calendar' | 'important') => {
    if (!userId || !selectedChannel) return;
    setBrainMenuTs(null);
    setBrainProcessing(msg.ts);

    try {
      const { data, error } = await supabase.functions.invoke('brain-slack-action', {
        body: {
          userId,
          channelId: selectedChannel.id,
          channelName: selectedChannel.name,
          messageText: msg.text,
          messageTs: msg.ts,
          senderName: userMap[msg.user]?.name || msg.user,
          actionType,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const actionLabels = { todo: 'TODO', calendar: '캘린더', important: '중요기록' };
      toast.success(`${actionLabels[actionType]}에 추가되었습니다`);
    } catch (e) {
      console.error('[SlackWidget] brain action:', e);
      toast.error('Brain AI 처리에 실패했습니다');
    } finally {
      setBrainProcessing(null);
    }
  }, [userId, selectedChannel, userMap]);

  // ─── Thread ───
  const loadThread = useCallback(async (channelId: string, threadTs: string) => {
    if (!userId) return;
    setThreadLoading(true);
    try {
      const data = await getSlackThread(userId, channelId, threadTs);
      setThreadMessages(data.messages || []);
      setUserMap(prev => ({ ...prev, ...(data.userMap || {}) }));
    } catch (e) { console.error('[SlackWidget] thread:', e); }
    finally { setThreadLoading(false); }
  }, [userId]);

  const openThread = useCallback((msg: SlackMessage) => {
    if (!selectedChannel) return;
    const ts = msg.thread_ts || msg.ts;
    setThreadParentTs(ts);
    loadThread(selectedChannel.id, ts);
  }, [selectedChannel, loadThread]);

  const closeThread = useCallback(() => {
    setThreadParentTs(null);
    setThreadMessages([]);
  }, []);

  // ─── OAuth connect ───
  const handleConnect = useCallback(() => {
    const state = userId || 'anonymous';
    const authUrl = getSlackAuthUrl(SLACK_REDIRECT_URI, state);
    if (!authUrl) { setError('Slack Client ID not configured'); return; }
    const popup = window.open(authUrl, 'slack-oauth', 'width=600,height=700');
    let codeSent = false;
    const interval = setInterval(() => {
      try {
        if (popup?.closed) { clearInterval(interval); return; }
        if (codeSent) return;
        const popupUrl = popup?.location?.href;
        if (popupUrl?.includes('/integrations/slack/callback')) {
          const url = new URL(popupUrl);
          const code = url.searchParams.get('code');
          const slackError = url.searchParams.get('error');
          if (slackError) { codeSent = true; popup?.close(); clearInterval(interval); setError(`Slack: ${slackError}`); return; }
          if (code) { codeSent = true; popup?.close(); clearInterval(interval); window.postMessage({ type: 'slack-oauth-callback', code }, window.location.origin); }
        }
      } catch { /* cross-origin */ }
    }, 500);
  }, [userId]);

  const handleDisconnect = useCallback(async () => {
    if (!userId) return;
    await disconnectSlack(userId);
    setStatus({ connected: false, teamName: null, teamIcon: null, teamId: null });
    setChannels([]);
    setSelectedChannel(null);
  }, [userId]);

  // Close menus on outside click
  useEffect(() => {
    if (!activeMenu && !emojiPickerTs) return;
    const handler = () => { setActiveMenu(null); setEmojiPickerTs(null); };
    const timer = setTimeout(() => document.addEventListener('click', handler), 0);
    return () => { clearTimeout(timer); document.removeEventListener('click', handler); };
  }, [activeMenu, emojiPickerTs]);

  // ─── Render: Loading ───
  if (loading && !status) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ─── Render: Not connected ───
  if (!status?.connected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
        <div className="w-12 h-12 rounded-xl bg-[#4A154B]/20 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none">
            <path d="M6.527 14.514A2.257 2.257 0 014.27 16.77a2.257 2.257 0 01-2.258-2.257 2.257 2.257 0 012.258-2.257h2.257v2.257zm1.134 0a2.257 2.257 0 012.257-2.257 2.257 2.257 0 012.257 2.257v5.649a2.257 2.257 0 01-2.257 2.257 2.257 2.257 0 01-2.257-2.257v-5.649z" fill="#E01E5A"/>
            <path d="M9.918 6.527A2.257 2.257 0 017.66 4.27a2.257 2.257 0 012.257-2.258 2.257 2.257 0 012.257 2.258v2.257H9.918zm0 1.134a2.257 2.257 0 012.257 2.257 2.257 2.257 0 01-2.257 2.257H4.27a2.257 2.257 0 01-2.258-2.257 2.257 2.257 0 012.258-2.257h5.649z" fill="#36C5F0"/>
            <path d="M17.473 9.918a2.257 2.257 0 012.257-2.258 2.257 2.257 0 012.258 2.258 2.257 2.257 0 01-2.258 2.257h-2.257V9.918zm-1.134 0a2.257 2.257 0 01-2.257 2.257 2.257 2.257 0 01-2.257-2.257V4.27a2.257 2.257 0 012.257-2.258 2.257 2.257 0 012.257 2.258v5.649z" fill="#2EB67D"/>
            <path d="M14.082 17.473a2.257 2.257 0 012.257 2.257 2.257 2.257 0 01-2.257 2.258 2.257 2.257 0 01-2.257-2.258v-2.257h2.257zm0-1.134a2.257 2.257 0 01-2.257-2.257 2.257 2.257 0 012.257-2.257h5.649a2.257 2.257 0 012.257 2.257 2.257 2.257 0 01-2.257 2.257h-5.649z" fill="#ECB22E"/>
          </svg>
        </div>
        <p className="text-sm text-muted-foreground text-center">
          Slack 워크스페이스를 연결해서<br />메시지를 확인하고 보내세요
        </p>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          onClick={handleConnect}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4A154B] text-white text-sm hover:bg-[#3a1139] transition-colors"
        >
          <Plug className="w-4 h-4" /> Slack 연결
        </button>
      </div>
    );
  }

  // ─── Render: Channel list ───
  if (!selectedChannel) {
    const filtered = channels.filter(ch => {
      if (!channelSearch) return true;
      const q = channelSearch.toLowerCase();
      return (ch.name || '').toLowerCase().includes(q) || (ch.user_name || '').toLowerCase().includes(q);
    });

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
          <div className="flex items-center gap-2 min-w-0">
            {status.teamIcon && <img src={status.teamIcon} alt="" className="w-5 h-5 rounded" />}
            <span className="text-sm font-medium truncate">{status.teamName}</span>
          </div>
          <button onClick={handleDisconnect} className="p-1 hover:bg-white/10 rounded text-muted-foreground" title="연결 해제">
            <Unplug className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-1.5">
          <input
            type="text" value={channelSearch} onChange={e => setChannelSearch(e.target.value)}
            placeholder="채널 검색..." className="w-full text-xs bg-transparent border border-border/30 rounded-md px-2 py-1 focus:outline-none focus:border-primary/50"
          />
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-auto px-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 text-center py-4">채널 없음</p>
          ) : (
            <div className="space-y-0.5">
              {filtered.map(ch => (
                <button key={ch.id} onClick={() => handleSelectChannel(ch)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 text-left transition-colors"
                >
                  {ch.is_im ? (
                    ch.user_avatar ? <img src={ch.user_avatar} className="w-5 h-5 rounded-full" alt="" /> : <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : ch.is_private ? (
                    <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <Hash className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-sm truncate">{ch.is_im ? (ch.user_name || 'DM') : ch.name}</span>
                  {ch.num_members && !ch.is_im && (
                    <span className="ml-auto text-[10px] text-muted-foreground/50 flex items-center gap-0.5">
                      <Users className="w-3 h-3" />{ch.num_members}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Message renderer ───
  const renderMessage = (msg: SlackMessage, isThread = false) => {
    if (msg.ts.startsWith('optimistic-')) {
      return (
        <div key={msg.ts} className="flex gap-2 opacity-50">
          <div className="w-7 h-7 rounded-full bg-primary/20 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold">나</span>
            <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
          </div>
        </div>
      );
    }

    const user = userMap[msg.user];
    const time = new Date(parseFloat(msg.ts) * 1000);
    const isMenuOpen = activeMenu === msg.ts;
    const isEmojiOpen = emojiPickerTs === msg.ts;
    const isBrainOpen = brainMenuTs === msg.ts;
    const hasThread = (msg.reply_count || 0) > 0 && !isThread;

    return (
      <div key={msg.ts} data-slack-msg={msg.ts} className="flex gap-2 group relative">
        {user?.avatar ? (
          <img src={user.avatar} alt="" className="w-7 h-7 rounded-full mt-0.5 shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-muted mt-0.5 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-semibold truncate">{user?.name || msg.user || 'Unknown'}</span>
            <span className="text-[10px] text-muted-foreground/50">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          {/* Edit mode */}
          {editingMsg?.ts === msg.ts ? (
            <div className="flex items-center gap-1 mt-0.5">
              <input type="text" value={editText} onChange={e => setEditText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleEdit(); if (e.key === 'Escape') { setEditingMsg(null); setEditText(''); } }}
                className="flex-1 text-sm bg-muted/30 border border-border/50 rounded px-2 py-0.5 focus:outline-none" autoFocus
              />
              <button onClick={handleEdit} className="p-0.5 hover:bg-green-500/20 rounded"><Check className="w-3.5 h-3.5 text-green-400" /></button>
              <button onClick={() => { setEditingMsg(null); setEditText(''); }} className="p-0.5 hover:bg-red-500/20 rounded"><X className="w-3.5 h-3.5 text-red-400" /></button>
            </div>
          ) : (
            <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">{formatSlackText(msg.text, userMap)}</p>
          )}

          {/* Files */}
          {msg.files && msg.files.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {msg.files.map((f, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">📎 {f.name}</span>
              ))}
            </div>
          )}

          {/* Reactions */}
          {msg.reactions && msg.reactions.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {msg.reactions.map((r, i) => (
                <button key={i} onClick={() => handleReaction(msg, SLACK_TO_EMOJI[r.name] || r.name)}
                  className={`text-[11px] px-1.5 py-0.5 rounded-full border transition-colors ${
                    r.users?.includes(userId || '') ? 'border-primary/50 bg-primary/10' : 'border-border/30 bg-muted/30 hover:bg-muted/50'
                  }`}
                >
                  {SLACK_TO_EMOJI[r.name] || `:${r.name}:`} {r.count}
                </button>
              ))}
            </div>
          )}

          {/* Thread indicator */}
          {hasThread && (
            <button onClick={() => openThread(msg)}
              className="mt-1 text-[11px] text-primary/70 hover:text-primary flex items-center gap-1"
            >
              <MessageCircle className="w-3 h-3" />
              {msg.reply_count}개 답장
            </button>
          )}
        </div>

        {/* Hover actions — inline right, not absolute to avoid overflow clipping */}
        <div className={`slack-action-bar absolute top-0 right-0 flex items-center gap-0.5 bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-md shadow-sm px-0.5 py-0.5 transition-opacity ${
          isMenuOpen || isEmojiOpen || isBrainOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}>
          <button onClick={e => { e.stopPropagation(); setEmojiPickerTs(isEmojiOpen ? null : msg.ts); setActiveMenu(null); setBrainMenuTs(null); }}
            className="p-0.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded" title="리액션">
            <Smile className="w-3.5 h-3.5" />
          </button>
          {/* Brain AI */}
          <button onClick={e => { e.stopPropagation(); setBrainMenuTs(isBrainOpen ? null : msg.ts); setActiveMenu(null); setEmojiPickerTs(null); }}
            className={`p-0.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded ${brainProcessing === msg.ts ? 'animate-pulse' : ''}`}
            title="Brain AI" disabled={brainProcessing === msg.ts}>
            <Sparkles className={`w-3.5 h-3.5 ${isBrainOpen ? 'text-primary' : ''}`} />
          </button>
          {!isThread && (
            <button onClick={() => openThread(msg)} className="p-0.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded" title="스레드">
              <MessageCircle className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); setActiveMenu(isMenuOpen ? null : msg.ts); setEmojiPickerTs(null); setBrainMenuTs(null); }}
            className="p-0.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded" title="더보기">
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Emoji quick picker — Portal to body */}
        {isEmojiOpen && (() => {
          const actionBar = document.querySelector(`[data-slack-msg="${msg.ts}"] .slack-action-bar`);
          if (!actionBar) return null;
          const r = actionBar.getBoundingClientRect();
          return createPortal(
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setEmojiPickerTs(null)} />
              <div className="fixed z-[9999] flex items-center gap-0.5 bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-lg shadow-lg px-1.5 py-1"
                style={{ top: r.bottom + 2, left: Math.max(8, r.left) }} onClick={e => e.stopPropagation()}>
                {QUICK_EMOJIS.map(emoji => (
                  <button key={emoji} onClick={() => handleReaction(msg, emoji)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors text-sm">{emoji}</button>
                ))}
              </div>
            </>,
            document.body
          );
        })()}

        {/* Context menu — Portal to body */}
        {isMenuOpen && (() => {
          const actionBar = document.querySelector(`[data-slack-msg="${msg.ts}"] .slack-action-bar`);
          if (!actionBar) return null;
          const r = actionBar.getBoundingClientRect();
          return createPortal(
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setActiveMenu(null)} />
              <div className="fixed z-[9999] bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-lg shadow-lg py-1 min-w-[120px]"
                style={{ top: r.bottom + 2, left: Math.max(8, r.right - 140) }} onClick={e => e.stopPropagation()}>
                <button onClick={() => { setEditingMsg(msg); setEditText(msg.text); setActiveMenu(null); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-zinc-700 transition">
                  <Pencil className="w-3 h-3" /> 수정
                </button>
                <button onClick={() => handlePin(msg, true)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-zinc-700 transition">
                  <Pin className="w-3 h-3" /> 고정
                </button>
                <button onClick={() => handlePin(msg, false)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-zinc-700 transition">
                  <PinOff className="w-3 h-3" /> 고정 해제
                </button>
                <div className="border-t border-gray-100 dark:border-zinc-700 my-0.5" />
                <button onClick={() => handleDelete(msg)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition">
                  <Trash2 className="w-3 h-3" /> 삭제
                </button>
              </div>
            </>,
            document.body
          );
        })()}

        {/* Brain AI menu — Portal to body */}
        {isBrainOpen && (() => {
          const actionBar = document.querySelector(`[data-slack-msg="${msg.ts}"] .slack-action-bar`);
          if (!actionBar) return null;
          const r = actionBar.getBoundingClientRect();
          return createPortal(
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setBrainMenuTs(null)} />
              <div className="fixed z-[9999] bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-lg shadow-lg py-1 min-w-[160px]"
                style={{ top: r.bottom + 2, left: Math.max(8, r.right - 180) }} onClick={e => e.stopPropagation()}>
                <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Brain AI</div>
                <button onClick={() => handleBrainAction(msg, 'todo')}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-zinc-700 transition">
                  <ListChecks className="w-3.5 h-3.5 text-blue-500" /> TODO 만들기
                </button>
                <button onClick={() => handleBrainAction(msg, 'calendar')}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-zinc-700 transition">
                  <CalendarPlus className="w-3.5 h-3.5 text-green-500" /> 캘린더에 추가
                </button>
                <button onClick={() => handleBrainAction(msg, 'important')}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-zinc-700 transition">
                  <Star className="w-3.5 h-3.5 text-amber-500" /> 중요기록 저장
                </button>
              </div>
            </>,
            document.body
          );
        })()}
      </div>
    );
  };

  const channelName = selectedChannel.is_im
    ? (selectedChannel.user_name || 'DM')
    : `#${selectedChannel.name}`;

  // ─── Render: Thread view ───
  if (threadParentTs) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
          <button onClick={closeThread} className="p-1 hover:bg-white/10 rounded"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-medium">스레드</span>
          <span className="text-xs text-muted-foreground ml-1">{channelName}</span>
        </div>
        <div className="flex-1 overflow-auto px-3 py-2 space-y-2">
          {threadLoading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : threadMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground/60 text-sm">답장 없음</div>
          ) : (
            threadMessages.map(msg => renderMessage(msg, true))
          )}
          <div ref={messagesEndRef} />
        </div>
        {/* Thread send */}
        <div className="px-3 py-2 border-t border-border/30">
          <div className="flex items-center gap-2">
            <input type="text" value={messageText} onChange={e => setMessageText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="스레드에 답장..." className="flex-1 text-sm bg-transparent border border-border/30 rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary/50"
            />
            <button onClick={handleSend} disabled={!messageText.trim() || sending} className="p-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 disabled:opacity-50">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: Message view ───
  return (
    <div className="flex flex-col h-full">
      {/* Channel header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
        <button onClick={() => { setSelectedChannel(null); setMessages([]); }} className="p-1 hover:bg-white/10 rounded">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium truncate">{channelName}</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => loadMessages(selectedChannel)} className="p-1 hover:bg-white/10 rounded"><RefreshCw className="w-3.5 h-3.5" /></button>
          <a href={`https://slack.com/app_redirect?channel=${selectedChannel.id}&team=${status.teamId}`}
            target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-white/10 rounded" title="Slack에서 열기">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto px-3 py-2 space-y-2">
        {messagesLoading ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground/60 text-sm">메시지 없음</div>
        ) : (
          messages.map(msg => renderMessage(msg))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Send message */}
      <div className="px-3 py-2 border-t border-border/30">
        <div className="flex items-center gap-2">
          <input type="text" value={messageText} onChange={e => setMessageText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`${channelName}에 메시지 보내기...`}
            className="flex-1 text-sm bg-transparent border border-border/30 rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary/50"
          />
          <button onClick={handleSend} disabled={!messageText.trim() || sending}
            className="p-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 disabled:opacity-50 transition-colors">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SlackWidget;
