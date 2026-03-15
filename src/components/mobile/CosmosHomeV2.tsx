/**
 * CosmosHomeV2 — Universal Chat Bar + Notifications (minimal safe version)
 */

import { useMemo, useState, useRef, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useWidgetStore } from '@/stores/widgetStore';
import { useTranslation } from '@/hooks/useTranslation';
import { ArrowUp, Loader2, MessageSquare, Bell, ChevronRight, Hash, AtSign, Sparkles, ListTodo, Calendar as CalIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────
interface SuggestionItem {
  type: 'user' | 'project' | 'group' | 'brain';
  id: string;
  name: string;
  avatar?: string;
  keyColor?: string;
  roomId?: string;
}

function CosmosHomeV2() {
  const currentUser = useAppStore(s => s.currentUser);
  const projects = useAppStore(s => s.projects);
  const users = useAppStore(s => s.users);
  const chatRooms = useAppStore(s => s.chatRooms);
  const appNotifications = useAppStore(s => s.appNotifications);

  const openMobileDm = useWidgetStore(s => s.openMobileDm);
  const openMobileGroupChat = useWidgetStore(s => s.openMobileGroupChat);
  const openProjectTab = useWidgetStore(s => s.openProjectTab);
  const setActiveTab = useWidgetStore(s => s.setActiveTab);

  const { language } = useTranslation();

  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<SuggestionItem | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const brainAgent: SuggestionItem = useMemo(() => ({
    type: 'brain' as const, id: '00000000-0000-0000-0000-000000000099', name: 'Brain AI',
  }), []);

  // ─── Suggestion lists ──────────────────────────────
  const allUsers = useMemo(() => {
    if (!users) return [];
    return users
      .filter(u => u.id !== currentUser?.id && u.id !== '00000000-0000-0000-0000-000000000099')
      .map(u => ({ type: 'user' as const, id: u.id, name: u.name || '', avatar: u.avatar }));
  }, [users, currentUser]);

  const allChannels = useMemo(() => {
    const items: SuggestionItem[] = [];
    if (projects) {
      for (const p of projects) {
        if (p.status === 'IN_PROGRESS' || p.status === 'PLANNING') {
          const room = chatRooms?.find(r => r.projectId === p.id);
          items.push({ type: 'project', id: p.id, name: p.title || '', keyColor: p.keyColor, roomId: room?.id });
        }
      }
    }
    // Skip getGroupRooms — use chatRooms directly
    if (chatRooms) {
      for (const r of chatRooms) {
        if (r.type === 'group') {
          items.push({ type: 'group', id: r.id, name: r.name || 'Group', roomId: r.id });
        }
      }
    }
    return items;
  }, [projects, chatRooms]);

  // ─── Input handler ─────────────────────────────────
  const handleInputChange = useCallback((value: string) => {
    setChatInput(value);
    const lastWord = value.split(' ').pop() || '';

    if (lastWord.startsWith('#')) {
      const q = lastWord.slice(1).toLowerCase();
      const f = allChannels.filter(s => s.name.toLowerCase().includes(q)).slice(0, 6);
      setSuggestions(f);
      setShowSuggestions(f.length > 0);
    } else if (lastWord.startsWith('@')) {
      const q = lastWord.slice(1).toLowerCase();
      const f = [brainAgent, ...allUsers].filter(s => s.name.toLowerCase().includes(q)).slice(0, 6);
      setSuggestions(f);
      setShowSuggestions(f.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [allChannels, allUsers, brainAgent]);

  const handleSelectSuggestion = useCallback((item: SuggestionItem) => {
    setSelectedTarget(item);
    setShowSuggestions(false);
    const words = chatInput.split(' ');
    words.pop();
    setChatInput(words.join(' '));
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [chatInput]);

  // ─── Send ──────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading || !currentUser) return;

    const target = selectedTarget || brainAgent;
    setChatLoading(true);

    try {
      if (target.type === 'brain') {
        const { processMessageWithLLM } = await import('@/services/brainService');
        await processMessageWithLLM({ messageContent: msg, userId: currentUser.id, chatMembers: [], language });
        openMobileDm('00000000-0000-0000-0000-000000000099');
      } else if (target.type === 'user') {
        const { sendDirectMessage } = await import('@/services/chatService');
        await sendDirectMessage(currentUser.id, target.id, msg);
        openMobileDm(target.id);
      } else if (target.roomId) {
        const { sendRoomMessage } = await import('@/services/chatService');
        await sendRoomMessage(target.roomId, currentUser.id, msg);
        openMobileGroupChat(target.roomId);
      }
      setChatInput('');
      setSelectedTarget(null);
    } catch (err) {
      console.error('[UniversalChat] Send error:', err);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, selectedTarget, currentUser, language, openMobileDm, openMobileGroupChat, brainAgent]);

  // ─── Notifications ─────────────────────────────────
  const unreadNotifs = useMemo(() => {
    if (!appNotifications) return [];
    return appNotifications.filter(n => !n.read).slice(0, 10);
  }, [appNotifications]);

  // ─── Greeting ──────────────────────────────────────
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const name = currentUser?.name?.split(' ')[0] || '';
    if (language === 'ko') {
      if (hour < 12) return `좋은 아침, ${name}`;
      if (hour < 18) return `안녕, ${name}`;
      return `좋은 저녁, ${name}`;
    }
    if (hour < 12) return `Good morning, ${name}`;
    if (hour < 18) return `Hey, ${name}`;
    return `Good evening, ${name}`;
  }, [currentUser, language]);

  const notifIcon = (type: string) => {
    if (type === 'chat') return <MessageSquare className="w-3.5 h-3.5 text-blue-400/60" />;
    if (type === 'todo') return <ListTodo className="w-3.5 h-3.5 text-emerald-400/60" />;
    if (type === 'event') return <CalIcon className="w-3.5 h-3.5 text-purple-400/60" />;
    if (type === 'brain') return <Sparkles className="w-3.5 h-3.5 text-amber-400/60" />;
    return <Bell className="w-3.5 h-3.5 text-white/30" />;
  };

  const notifBg = (type: string) => {
    if (type === 'chat') return 'bg-blue-500/15';
    if (type === 'todo') return 'bg-emerald-500/15';
    if (type === 'event') return 'bg-purple-500/15';
    if (type === 'brain') return 'bg-amber-500/15';
    return 'bg-white/[0.05]';
  };

  const handleNotifClick = useCallback((notif: { type: string; directUserId?: string; roomId?: string; projectId?: string }) => {
    try {
      if (notif.directUserId) {
        openMobileDm(notif.directUserId);
      } else if (notif.roomId) {
        openMobileGroupChat(notif.roomId);
      } else if (notif.projectId && projects) {
        const project = projects.find(p => p.id === notif.projectId);
        if (project) {
          openProjectTab(project.id, project.title || '', project.keyColor);
          setActiveTab(project.id);
        }
      }
    } catch (err) {
      console.error('[CosmosHome] Notif click error:', err);
    }
  }, [projects, openMobileDm, openMobileGroupChat, openProjectTab, setActiveTab]);

  return (
    <div className="relative flex flex-col h-full overflow-hidden bg-background">
      {/* Greeting + Chat Bar */}
      <div className="relative z-10 shrink-0 px-6 pt-14 pb-3">
        <h1 className="text-[26px] font-bold tracking-tight text-foreground">{greeting}</h1>

        {/* Universal Chat Bar */}
        <div className="mt-4 relative">
          {selectedTarget && (
            <div className="flex items-center gap-1.5 mb-2">
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
                selectedTarget.type === 'brain' ? 'bg-amber-500/20 text-amber-300' :
                selectedTarget.type === 'user' ? 'bg-blue-500/20 text-blue-300' :
                'bg-emerald-500/20 text-emerald-300'
              )}>
                {selectedTarget.type === 'brain' ? <Sparkles className="w-3 h-3" /> :
                 selectedTarget.type === 'user' ? <AtSign className="w-3 h-3" /> :
                 <Hash className="w-3 h-3" />}
                {selectedTarget.name}
              </span>
              <button onClick={() => setSelectedTarget(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
            </div>
          )}

          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-border/30 bg-muted/20">
            <MessageSquare className="w-4 h-4 text-muted-foreground/40 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={chatInput}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
              placeholder={
                selectedTarget
                  ? (language === 'ko' ? `${selectedTarget.name}에게 메시지...` : `Message ${selectedTarget.name}...`)
                  : (language === 'ko' ? '# 채널  @ 사람  메시지 입력...' : '# channel  @ person  type a message...')
              }
              className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/30 outline-none"
              disabled={chatLoading}
            />
            {chatLoading ? (
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
            ) : chatInput.trim() ? (
              <button onClick={handleSend} className="w-6 h-6 rounded-md flex items-center justify-center bg-primary text-primary-foreground">
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>

          {/* Autocomplete dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 mt-1 rounded-xl border border-border/50 bg-popover shadow-lg overflow-hidden z-20">
              {suggestions.map(item => (
                <button
                  key={`${item.type}-${item.id}`}
                  onClick={() => handleSelectSuggestion(item)}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-accent transition-colors text-left"
                >
                  {item.type === 'brain' ? (
                    <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                  ) : item.type === 'user' ? (
                    <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 text-[11px] font-bold text-blue-300 overflow-hidden">
                      {item.avatar ? <img src={item.avatar} className="w-7 h-7 rounded-full object-cover" alt="" /> : (item.name || '?').charAt(0)}
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: item.keyColor ? `${item.keyColor}30` : 'rgba(128,128,128,0.15)' }}>
                      <Hash className="w-3.5 h-3.5" style={{ color: item.keyColor || 'rgba(128,128,128,0.6)' }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-foreground/70 truncate">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground/50">
                      {item.type === 'brain' ? 'AI Agent' :
                       item.type === 'user' ? (language === 'ko' ? '개인 메시지' : 'Direct message') :
                       item.type === 'project' ? (language === 'ko' ? '프로젝트' : 'Project') :
                       (language === 'ko' ? '그룹' : 'Group')}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notifications */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        <div className="px-6 pb-24">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-3.5 h-3.5 text-muted-foreground/40" />
            <p className="text-xs font-medium text-muted-foreground/40 uppercase tracking-[0.15em]">
              {language === 'ko' ? '알림' : 'Notifications'}
            </p>
            {unreadNotifs.length > 0 && (
              <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                {unreadNotifs.length}
              </span>
            )}
          </div>

          {unreadNotifs.length === 0 ? (
            <div className="rounded-xl p-6 border border-dashed border-border/30 text-center">
              <p className="text-xs text-muted-foreground/30">
                {language === 'ko' ? '조용한 하루예요 ✨' : 'All quiet today ✨'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {unreadNotifs.map((notif) => (
                <button
                  key={notif.id}
                  className="w-full rounded-xl p-3 border border-border/20 bg-card/50 flex items-start gap-3 active:bg-accent transition-colors text-left"
                  onClick={() => handleNotifClick(notif)}
                >
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5', notifBg(notif.type))}>
                    {notifIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-foreground/60 truncate">{notif.title}</p>
                    {notif.message && (
                      <p className="text-[11px] text-muted-foreground/40 truncate mt-0.5">{notif.message}</p>
                    )}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/20 shrink-0 mt-1" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CosmosHomeV2;
