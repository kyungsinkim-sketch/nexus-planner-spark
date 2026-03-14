/**
 * CosmosHome — 모바일 랜딩 (Vercel-inspired minimal)
 *
 * 구조: Universal Chat Bar → Notifications
 * - Universal Chat Bar: # → 프로젝트/그룹, @ → 사람/AI Agent
 * - Notifications: 새 메시지, 이메일, 알림 통합
 */

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useWidgetStore } from '@/stores/widgetStore';
import { useTranslation } from '@/hooks/useTranslation';
import { format } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { ArrowUp, Loader2, MessageSquare, Mail, Bell, ChevronRight, Hash, AtSign, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

// Subtle particles
function CosmosParticles({ count = 25 }: { count?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    interface Star { x: number; y: number; r: number; alpha: number; speed: number; phase: number }
    const stars: Star[] = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h, r: Math.random() * 0.8 + 0.2,
      alpha: Math.random() * 0.2 + 0.03, speed: Math.random() * 0.3 + 0.1, phase: Math.random() * Math.PI * 2,
    }));
    let animId: number; let t = 0;
    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h); t += 0.008;
      for (const s of stars) {
        ctx.globalAlpha = s.alpha * (0.3 + 0.7 * Math.sin(t * s.speed * 4 + s.phase) ** 2);
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animId);
  }, [count]);
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" style={{ width: '100%', height: '100%' }} />;
}

// ─── Types ───────────────────────────────────────────
interface SuggestionItem {
  type: 'user' | 'project' | 'group' | 'brain';
  id: string;
  name: string;
  avatar?: string;
  keyColor?: string;
  roomId?: string;
}

export function CosmosHome() {
  const { events, projects, currentUser, users, chatRooms, getGroupRooms, companyNotifications, dismissedNotificationIds } = useAppStore();
  const { openMobileDm, openMobileGroupChat, setMobileView } = useWidgetStore();
  const { language } = useTranslation();
  const locale = language === 'ko' ? ko : enUS;

  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<SuggestionItem | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── Build suggestion lists ─────────────────────────
  const allUsers = useMemo(() => {
    return (users || [])
      .filter(u => u.id !== currentUser?.id && u.id !== '00000000-0000-0000-0000-000000000099')
      .map(u => ({ type: 'user' as const, id: u.id, name: u.name, avatar: u.avatar }));
  }, [users, currentUser]);

  const allProjects = useMemo(() => {
    return (projects || [])
      .filter(p => p.status === 'IN_PROGRESS' || p.status === 'PLANNING')
      .map(p => {
        const room = chatRooms.find(r => r.projectId === p.id);
        return { type: 'project' as const, id: p.id, name: p.title, keyColor: p.keyColor, roomId: room?.id };
      });
  }, [projects, chatRooms]);

  const allGroups = useMemo(() => {
    const groupRooms = getGroupRooms();
    return groupRooms.map(r => ({
      type: 'group' as const, id: r.id, name: r.name || 'Group', roomId: r.id,
    }));
  }, [getGroupRooms]);

  const brainAgent: SuggestionItem = {
    type: 'brain', id: '00000000-0000-0000-0000-000000000099', name: 'Brain AI',
  };

  // ─── Input change handler with # @ detection ───────
  const handleInputChange = useCallback((value: string) => {
    setChatInput(value);

    // Detect # or @ trigger
    const lastWord = value.split(' ').pop() || '';

    if (lastWord.startsWith('#')) {
      const query = lastWord.slice(1).toLowerCase();
      const filtered = [...allProjects, ...allGroups].filter(
        s => s.name.toLowerCase().includes(query)
      ).slice(0, 6);
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else if (lastWord.startsWith('@')) {
      const query = lastWord.slice(1).toLowerCase();
      const filtered = [brainAgent, ...allUsers].filter(
        s => s.name.toLowerCase().includes(query)
      ).slice(0, 6);
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [allProjects, allGroups, allUsers, brainAgent]);

  // ─── Select a suggestion ───────────────────────────
  const handleSelectSuggestion = useCallback((item: SuggestionItem) => {
    setSelectedTarget(item);
    setShowSuggestions(false);
    // Remove the #/@ trigger word from input
    const words = chatInput.split(' ');
    words.pop(); // Remove the trigger word
    setChatInput(words.join(' '));
    // Focus back to input
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [chatInput]);

  // ─── Send message ──────────────────────────────────
  const handleSend = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    if (!selectedTarget) {
      // No target selected — default to Brain AI
      setSelectedTarget(brainAgent);
    }

    const target = selectedTarget || brainAgent;
    setChatLoading(true);

    try {
      if (target.type === 'brain') {
        // Send to Brain AI via DM, then navigate
        const { processMessageWithLLM } = await import('@/services/brainService');
        await processMessageWithLLM({
          messageContent: msg,
          userId: currentUser?.id || '',
          chatMembers: [],
          language,
        });
        setChatInput('');
        setSelectedTarget(null);
        // Navigate to Brain AI DM
        openMobileDm('00000000-0000-0000-0000-000000000099');
      } else if (target.type === 'user') {
        // Send DM
        const { sendDirectMessage } = await import('@/services/chatService');
        await sendDirectMessage(currentUser?.id || '', target.id, msg);
        setChatInput('');
        setSelectedTarget(null);
        openMobileDm(target.id);
      } else if (target.type === 'project' && target.roomId) {
        // Send to project chat room
        const { sendRoomMessage } = await import('@/services/chatService');
        await sendRoomMessage(target.roomId, currentUser?.id || '', msg);
        setChatInput('');
        setSelectedTarget(null);
        // Navigate to project chat
        setMobileView('dm-chat');
        openMobileGroupChat(target.roomId);
      } else if (target.type === 'group' && target.roomId) {
        // Send to group chat room
        const { sendRoomMessage } = await import('@/services/chatService');
        await sendRoomMessage(target.roomId, currentUser?.id || '', msg);
        setChatInput('');
        setSelectedTarget(null);
        openMobileGroupChat(target.roomId);
      }
    } catch (err) {
      console.error('[UniversalChat] Send error:', err);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, selectedTarget, currentUser, language, openMobileDm, openMobileGroupChat, setMobileView, brainAgent]);

  // ─── Notifications ─────────────────────────────────
  const activeNotifications = useMemo(() => {
    return (companyNotifications || [])
      .filter(n => !dismissedNotificationIds.includes(n.id))
      .slice(0, 8);
  }, [companyNotifications, dismissedNotificationIds]);

  // ─── Greeting ──────────────────────────────────────
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const name = currentUser?.name?.split(' ')[0] || '';
    if (hour < 12) return language === 'ko' ? `좋은 아침, ${name}` : `Good morning, ${name}`;
    if (hour < 18) return language === 'ko' ? `안녕, ${name}` : `Hey, ${name}`;
    return language === 'ko' ? `좋은 저녁, ${name}` : `Good evening, ${name}`;
  }, [currentUser, language]);

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      <CosmosParticles />

      {/* Top section — Greeting + Universal Chat Bar */}
      <div className="relative z-10 shrink-0 px-6 pt-14 pb-3">
        {/* Greeting */}
        <h1 className="text-[26px] font-bold tracking-tight text-white">{greeting}</h1>
        <p className="text-xs text-white/20 mt-0.5 font-mono">
          {format(new Date(), language === 'ko' ? 'yyyy.MM.dd EEEE' : 'EEEE, MMMM d', { locale })}
        </p>

        {/* Universal Chat Bar */}
        <div className="mt-4 relative">
          {/* Selected target badge */}
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
              <button
                onClick={() => setSelectedTarget(null)}
                className="text-white/20 hover:text-white/40 text-xs"
              >✕</button>
            </div>
          )}

          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            {!selectedTarget ? (
              <MessageSquare className="w-4 h-4 text-white/15 shrink-0" />
            ) : selectedTarget.type === 'brain' ? (
              <Sparkles className="w-4 h-4 text-amber-400/40 shrink-0" />
            ) : (
              <MessageSquare className="w-4 h-4 text-white/15 shrink-0" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={chatInput}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder={
                selectedTarget
                  ? (language === 'ko' ? `${selectedTarget.name}에게 메시지...` : `Message ${selectedTarget.name}...`)
                  : (language === 'ko' ? '# 채널  @ 사람  메시지 입력...' : '# channel  @ person  type a message...')
              }
              className="flex-1 bg-transparent text-[13px] text-white placeholder:text-white/15 outline-none"
              disabled={chatLoading}
            />
            {chatLoading ? (
              <Loader2 className="w-4 h-4 text-white/30 animate-spin" />
            ) : chatInput.trim() ? (
              <button onClick={handleSend}
                className="w-6 h-6 rounded-md flex items-center justify-center bg-white text-black">
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>

          {/* Autocomplete dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              className="absolute left-0 right-0 mt-1 rounded-xl border border-white/[0.08] overflow-hidden z-20"
              style={{
                background: 'rgba(30, 30, 35, 0.95)',
                backdropFilter: 'blur(20px)',
              }}
            >
              {suggestions.map(item => (
                <button
                  key={`${item.type}-${item.id}`}
                  onClick={() => handleSelectSuggestion(item)}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-white/[0.05] active:bg-white/[0.08] transition-colors text-left"
                >
                  {item.type === 'brain' ? (
                    <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                  ) : item.type === 'user' ? (
                    <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 text-[11px] font-bold text-blue-300">
                      {item.avatar ? (
                        <img src={item.avatar} className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        item.name.charAt(0)
                      )}
                    </div>
                  ) : (
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: item.keyColor ? `${item.keyColor}30` : 'rgba(255,255,255,0.08)' }}
                    >
                      <Hash className="w-3.5 h-3.5" style={{ color: item.keyColor || 'rgba(255,255,255,0.4)' }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-white/70 truncate">{item.name}</p>
                    <p className="text-[10px] text-white/20">
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

      {/* Scrollable Notifications */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        <div className="px-6 pb-24">
          {/* Section header */}
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-3.5 h-3.5 text-white/20" />
            <p className="text-xs font-medium text-white/20 uppercase tracking-[0.15em]">
              {language === 'ko' ? '알림' : 'Notifications'}
            </p>
            {activeNotifications.length > 0 && (
              <span className="text-[10px] bg-white/10 text-white/40 px-1.5 py-0.5 rounded-full">
                {activeNotifications.length}
              </span>
            )}
          </div>

          {activeNotifications.length === 0 ? (
            <div className="rounded-xl p-6 border border-dashed border-white/[0.04] text-center">
              <p className="text-xs text-white/15">
                {language === 'ko' ? '조용한 하루예요 ✨' : 'All quiet today ✨'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {activeNotifications.map((notif, i) => {
                const isChat = notif.type === 'chat' || notif.type === 'dm';
                const isEmail = notif.type === 'email';
                return (
                  <button
                    key={notif.id}
                    className="w-full rounded-xl p-3 border border-white/[0.04] bg-white/[0.01] flex items-start gap-3 active:bg-white/[0.04] transition-colors text-left animate-fade-in"
                    style={{ animationDelay: `${i * 60}ms` }}
                    onClick={() => {
                      // Navigate based on notification type
                      if (isChat && notif.sourceId) {
                        openMobileDm(notif.sourceId);
                      } else if (notif.projectId) {
                        // Open project
                        const { openProjectTab, setActiveTab } = useWidgetStore.getState();
                        const project = projects.find(p => p.id === notif.projectId);
                        if (project) {
                          openProjectTab(project.id, project.title, project.keyColor);
                          setActiveTab(project.id);
                        }
                      }
                    }}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                      isChat ? 'bg-blue-500/15' : isEmail ? 'bg-emerald-500/15' : 'bg-white/[0.05]'
                    )}>
                      {isChat ? <MessageSquare className="w-3.5 h-3.5 text-blue-400/60" /> :
                       isEmail ? <Mail className="w-3.5 h-3.5 text-emerald-400/60" /> :
                       <Bell className="w-3.5 h-3.5 text-white/30" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-white/60 truncate">
                        {notif.title || notif.content}
                      </p>
                      {notif.content && notif.title && (
                        <p className="text-[11px] text-white/25 truncate mt-0.5">
                          {notif.content}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-white/10 shrink-0 mt-1" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CosmosHome;
