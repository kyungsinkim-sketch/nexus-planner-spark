/**
 * CosmosHome — 모바일 랜딩 (Vercel-inspired minimal + cosmos)
 *
 * 과거와 현재의 조우:
 * - 오늘 일정에 연결된 프로젝트의 핵심 메모리
 * - AI가 "기억할 한마디" 표시
 * - 하단에 Brain AI 명령 입력창 (직접 인라인)
 */

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { format, parseISO, startOfDay, endOfDay, isBefore, isAfter } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { Sparkles, Send, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// Subtle floating particles — white, very dim
function CosmosParticles({ count = 30 }: { count?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();

    const w = window.innerWidth;
    const h = window.innerHeight;

    interface Star { x: number; y: number; r: number; alpha: number; speed: number; phase: number }
    const stars: Star[] = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1 + 0.2,
      alpha: Math.random() * 0.3 + 0.05,
      speed: Math.random() * 0.3 + 0.1,
      phase: Math.random() * Math.PI * 2,
    }));

    let animId: number;
    let t = 0;

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      t += 0.008;
      for (const s of stars) {
        const flicker = 0.3 + 0.7 * Math.sin(t * s.speed * 4 + s.phase) ** 2;
        ctx.globalAlpha = s.alpha * flicker;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animId);
  }, [count]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ width: '100%', height: '100%' }}
    />
  );
}

// Memory node — floating card
function MemoryNode({
  title, content, time, projectColor, delay = 0,
}: {
  title: string; content: string; time?: string; projectColor?: string; delay?: number;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div className={cn(
      'transition-all duration-700 ease-out',
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
    )}>
      <div
        className="rounded-xl p-3.5 border"
        style={{
          background: 'hsl(var(--card))',
          borderColor: 'hsl(var(--border))',
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
            style={{ backgroundColor: projectColor || '#fff' }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[11px] font-medium text-white/50 truncate">
                {title}
              </span>
              {time && (
                <span className="text-[10px] text-white/25 shrink-0 font-mono">{time}</span>
              )}
            </div>
            <p className="text-[13px] text-white/80 leading-relaxed">{content}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CosmosHome() {
  const { events, projects, currentUser } = useAppStore();
  const { language } = useTranslation();
  const locale = language === 'ko' ? ko : enUS;
  const [brainInput, setBrainInput] = useState('');
  const [brainResponse, setBrainResponse] = useState<string | null>(null);
  const [brainLoading, setBrainLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const todayEvents = useMemo(() => {
    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);
    return events
      .filter(e => {
        try {
          const start = parseISO(e.startAt);
          return !isBefore(start, dayStart) && !isAfter(start, dayEnd);
        } catch { return false; }
      })
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .slice(0, 5);
  }, [events]);

  const memoryNodes = useMemo(() => {
    const nodes: Array<{ id: string; title: string; content: string; time?: string; projectColor?: string }> = [];
    for (const event of todayEvents) {
      const project = projects.find(p => p.id === event.projectId);
      nodes.push({
        id: event.id,
        title: project?.title || event.title,
        content: event.title,
        time: format(parseISO(event.startAt), 'HH:mm'),
        projectColor: project?.keyColor,
      });
    }
    if (nodes.length === 0) {
      nodes.push({
        id: 'empty',
        title: language === 'ko' ? '오늘' : 'Today',
        content: language === 'ko' ? '예정된 일정이 없습니다.' : 'No events scheduled.',
      });
    }
    return nodes;
  }, [todayEvents, projects, language]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const name = currentUser?.name?.split(' ')[0] || '';
    if (hour < 12) return language === 'ko' ? `좋은 아침, ${name}` : `Good morning, ${name}`;
    if (hour < 18) return language === 'ko' ? `안녕, ${name}` : `Hey, ${name}`;
    return language === 'ko' ? `좋은 저녁, ${name}` : `Good evening, ${name}`;
  }, [currentUser, language]);

  const handleBrainSubmit = useCallback(async () => {
    if (!brainInput.trim() || brainLoading) return;
    const msg = brainInput.trim();
    setBrainInput('');
    setBrainLoading(true);
    setBrainResponse(null);
    try {
      // Call Brain AI edge function
      const { supabase } = await import('@/lib/supabase');
      const { data } = await supabase.functions.invoke('brain-chat', { body: { message: msg } });
      setBrainResponse(data?.reply || data?.message || (language === 'ko' ? '처리 완료' : 'Done'));
    } catch {
      setBrainResponse(language === 'ko' ? '오류가 발생했습니다.' : 'An error occurred.');
    } finally {
      setBrainLoading(false);
    }
  }, [brainInput, brainLoading, language]);

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      <CosmosParticles />

      <div className="relative z-10 flex-1 overflow-y-auto">
        <div className="px-6 pt-14 pb-8 space-y-8">
          {/* Greeting */}
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-white">
              {greeting}
            </h1>
            <p className="text-[13px] text-white/30 mt-1 font-mono">
              {format(new Date(), language === 'ko' ? 'yyyy.MM.dd EEEE' : 'EEEE, MMMM d', { locale })}
            </p>
          </div>

          {/* AI Insight — minimal */}
          {todayEvents.length > 0 && (
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-3.5 h-3.5 text-[#D4A843] mt-0.5 shrink-0" />
              <p className="text-[13px] text-white/50 leading-relaxed">
                {language === 'ko'
                  ? `오늘 ${todayEvents.length}개 일정. ${todayEvents[0].title}부터 시작.`
                  : `${todayEvents.length} events today. Starting with ${todayEvents[0].title}.`}
              </p>
            </div>
          )}

          {/* Timeline */}
          <div>
            <p className="text-[11px] text-white/20 uppercase tracking-[0.15em] font-medium mb-4">
              {language === 'ko' ? '타임라인' : 'Timeline'}
            </p>
            <div className="space-y-2.5">
              {memoryNodes.map((node, i) => (
                <MemoryNode
                  key={node.id}
                  title={node.title}
                  content={node.content}
                  time={node.time}
                  projectColor={node.projectColor}
                  delay={i * 120}
                />
              ))}
            </div>
          </div>

          {/* Brain AI Response */}
          {brainResponse && (
            <div className="rounded-xl p-3.5 border border-white/5 bg-white/[0.02]">
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-3.5 h-3.5 text-[#D4A843] mt-0.5 shrink-0" />
                <p className="text-[13px] text-white/70 leading-relaxed">{brainResponse}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Brain AI Input — fixed bottom, above nav */}
      <div className="relative z-20 px-4 pb-2 pt-2"
        style={{ background: 'linear-gradient(to top, black 60%, transparent)' }}
      >
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl border"
          style={{
            background: 'hsl(var(--card))',
            borderColor: 'hsl(var(--border))',
          }}
        >
          <Sparkles className="w-4 h-4 text-white/20 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={brainInput}
            onChange={e => setBrainInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleBrainSubmit()}
            placeholder={language === 'ko' ? 'Brain AI에게 물어보세요...' : 'Ask Brain AI...'}
            className="flex-1 bg-transparent text-[13px] text-white placeholder:text-white/20 outline-none"
            disabled={brainLoading}
          />
          {brainInput.trim() && (
            <button
              onClick={handleBrainSubmit}
              disabled={brainLoading}
              className="w-7 h-7 rounded-lg flex items-center justify-center bg-white text-black transition-opacity hover:opacity-80"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          {brainLoading && (
            <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          )}
        </div>
      </div>
    </div>
  );
}

export default CosmosHome;
