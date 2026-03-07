/**
 * SlackWidget — Displays Slack messages from connected workspace.
 *
 * Features:
 * - OAuth connect flow
 * - Channel list with selection
 * - Message history with user avatars
 * - Send message from within Re-Be
 * - Link channels to projects
 * - Works in both Dashboard and Project contexts
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Hash, Lock, MessageSquare, Send, ExternalLink, Loader2,
  ChevronLeft, Users, Plug, Unplug, RefreshCw,
} from 'lucide-react';
import {
  getSlackAuthUrl, exchangeSlackCode, getSlackStatus, getSlackChannels,
  getSlackMessages, sendSlackMessage, disconnectSlack,
  formatSlackText,
  type SlackChannel, type SlackMessage, type SlackUserInfo, type SlackStatus,
} from '@/services/slackService';
import type { WidgetDataContext } from '@/types/widget';

// ─── Slack OAuth redirect URI ───
const SLACK_REDIRECT_URI = `${window.location.origin}/integrations/slack/callback`;

function SlackWidget({ context }: { context: WidgetDataContext }) {
  const { t } = useTranslation();
  const { currentUser } = useAppStore();
  const userId = currentUser?.id;

  // Connection state
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Channel list state
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<SlackChannel | null>(null);

  // Message state
  const [messages, setMessages] = useState<SlackMessage[]>([]);
  const [userMap, setUserMap] = useState<Record<string, SlackUserInfo>>({});
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Send message state
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isProjectContext = context.type === 'project' && !!context.projectId;

  // ─── Check connection on mount ───
  useEffect(() => {
    if (!userId) return;
    checkStatus();
  }, [userId]);

  // ─── Handle OAuth callback ───
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'slack-oauth-callback' && event.data?.code) {
        setLoading(true);
        setError(null);
        try {
          const result = await exchangeSlackCode(event.data.code, SLACK_REDIRECT_URI, userId!);
          if (result.success) {
            await checkStatus();
          } else {
            setError(result.error || 'OAuth failed');
          }
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setLoading(false);
        }
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
      if (s.connected) {
        await loadChannels();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadChannels = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await getSlackChannels(userId);
      // Sort: channels first, then groups, then IMs
      const sorted = data.channels.sort((a, b) => {
        if (a.is_channel && !b.is_channel) return -1;
        if (!a.is_channel && b.is_channel) return 1;
        if (a.is_im && !b.is_im) return 1;
        if (!a.is_im && b.is_im) return -1;
        return (a.name || '').localeCompare(b.name || '');
      });
      setChannels(sorted);
    } catch (e) {
      console.error('[SlackWidget] Failed to load channels:', e);
    }
  }, [userId]);

  const loadMessages = useCallback(async (channel: SlackChannel) => {
    if (!userId) return;
    setMessagesLoading(true);
    try {
      const data = await getSlackMessages(userId, channel.id);
      // Messages come newest-first from Slack, reverse for display
      setMessages([...(data.messages || [])].reverse());
      setUserMap(data.userMap || {});
    } catch (e) {
      console.error('[SlackWidget] Failed to load messages:', e);
    } finally {
      setMessagesLoading(false);
    }
  }, [userId]);

  const handleSelectChannel = useCallback((channel: SlackChannel) => {
    setSelectedChannel(channel);
    loadMessages(channel);
  }, [loadMessages]);

  const handleSend = useCallback(async () => {
    if (!userId || !selectedChannel || !messageText.trim()) return;
    setSending(true);
    try {
      await sendSlackMessage(userId, selectedChannel.id, messageText.trim());
      setMessageText('');
      // Reload messages after sending
      await loadMessages(selectedChannel);
    } catch (e) {
      console.error('[SlackWidget] Failed to send:', e);
    } finally {
      setSending(false);
    }
  }, [userId, selectedChannel, messageText, loadMessages]);

  const handleConnect = useCallback(() => {
    const state = userId || 'anonymous';
    const authUrl = getSlackAuthUrl(SLACK_REDIRECT_URI, state);
    if (!authUrl) {
      setError('Slack Client ID not configured');
      return;
    }
    // Open OAuth popup
    const popup = window.open(authUrl, 'slack-oauth', 'width=600,height=700');

    // Listen for the popup to redirect back
    const interval = setInterval(() => {
      try {
        if (popup?.closed) {
          clearInterval(interval);
          return;
        }
        const popupUrl = popup?.location?.href;
        if (popupUrl?.includes('/integrations/slack/callback')) {
          const url = new URL(popupUrl);
          const code = url.searchParams.get('code');
          if (code) {
            popup?.close();
            clearInterval(interval);
            window.postMessage({ type: 'slack-oauth-callback', code }, '*');
          }
        }
      } catch {
        // Cross-origin — ignore until redirect happens
      }
    }, 500);
  }, [userId]);

  const handleDisconnect = useCallback(async () => {
    if (!userId) return;
    await disconnectSlack(userId);
    setStatus({ connected: false, teamName: null, teamIcon: null, teamId: null });
    setChannels([]);
    setSelectedChannel(null);
    setMessages([]);
  }, [userId]);

  // Scroll to bottom when new messages load
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Not connected: show connect button ───
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-4">
        <div className="w-12 h-12 rounded-xl bg-[#4A154B] flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="currentColor">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
          </svg>
        </div>
        <p className="text-sm text-muted-foreground text-center">
          Slack 워크스페이스를 연결하세요
        </p>
        <button
          onClick={handleConnect}
          className="px-4 py-2 rounded-lg bg-[#4A154B] text-white text-sm font-medium hover:bg-[#3a1139] transition-colors flex items-center gap-2"
        >
          <Plug className="w-4 h-4" />
          Slack 연결
        </button>
        {error && (
          <p className="text-xs text-destructive mt-1">{error}</p>
        )}
      </div>
    );
  }

  // ─── Channel list view ───
  if (!selectedChannel) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
          <div className="flex items-center gap-2 min-w-0">
            {status.teamIcon && (
              <img src={status.teamIcon} alt="" className="w-5 h-5 rounded" />
            )}
            <span className="text-xs font-medium truncate">{status.teamName}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => loadChannels()} className="p-1 hover:bg-white/10 rounded" title="새로고침">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleDisconnect} className="p-1 hover:bg-destructive/20 rounded" title="연결 해제">
              <Unplug className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-auto">
          {channels.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground/60 text-sm">
              채널 없음
            </div>
          ) : (
            <div className="py-1">
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => handleSelectChannel(ch)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors text-left"
                >
                  {ch.is_im ? (
                    ch.user_avatar ? (
                      <img src={ch.user_avatar} alt="" className="w-5 h-5 rounded-full" />
                    ) : (
                      <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                    )
                  ) : ch.is_private ? (
                    <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <Hash className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-sm truncate">
                    {ch.is_im ? (ch.user_name || 'DM') : ch.name}
                  </span>
                  {ch.num_members && !ch.is_im && (
                    <span className="ml-auto text-[10px] text-muted-foreground/50 flex items-center gap-0.5">
                      <Users className="w-3 h-3" />
                      {ch.num_members}
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

  // ─── Message view ───
  const channelName = selectedChannel.is_im
    ? (selectedChannel.user_name || 'DM')
    : `#${selectedChannel.name}`;

  return (
    <div className="flex flex-col h-full">
      {/* Channel header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
        <button
          onClick={() => { setSelectedChannel(null); setMessages([]); }}
          className="p-1 hover:bg-white/10 rounded"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium truncate">{channelName}</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => loadMessages(selectedChannel)} className="p-1 hover:bg-white/10 rounded">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <a
            href={`https://slack.com/app_redirect?channel=${selectedChannel.id}&team=${status.teamId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 hover:bg-white/10 rounded"
            title="Slack에서 열기"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto px-3 py-2 space-y-2">
        {messagesLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground/60 text-sm">
            메시지 없음
          </div>
        ) : (
          messages.map((msg) => {
            const user = userMap[msg.user];
            const time = new Date(parseFloat(msg.ts) * 1000);
            return (
              <div key={msg.ts} className="flex gap-2 group">
                {user?.avatar ? (
                  <img src={user.avatar} alt="" className="w-7 h-7 rounded-full mt-0.5 shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-muted mt-0.5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-semibold truncate">
                      {user?.name || msg.user || 'Unknown'}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50">
                      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
                    {formatSlackText(msg.text, userMap)}
                  </p>
                  {msg.files && msg.files.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {msg.files.map((f, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                          📎 {f.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {msg.reactions.map((r, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/50">
                          :{r.name}: {r.count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Send message */}
      <div className="px-3 py-2 border-t border-border/30">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`${channelName}에 메시지 보내기...`}
            className="flex-1 text-sm bg-transparent border border-border/30 rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary/50"
          />
          <button
            onClick={handleSend}
            disabled={!messageText.trim() || sending}
            className="p-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 disabled:opacity-50 transition-colors"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SlackWidget;
