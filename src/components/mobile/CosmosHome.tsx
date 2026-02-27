/**
 * CosmosHome — 모바일 랜딩 (Time Machine 스타일)
 *
 * 과거와 현재의 조우:
 * - 오늘 일정에 연결된 프로젝트의 핵심 RAG 메모리를 보여줌
 * - 개인 AI가 "기억할 한마디" 또는 제안 사항 표시
 * - 하단에 Brain AI 채팅 위젯
 *
 * 우주 공간 속 데이터가 시간순으로 누적되는 비주얼
 */

import { useMemo, useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { format, parseISO, isToday, startOfDay, endOfDay, isBefore, isAfter } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { Sparkles, ChevronRight, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWidgetStore } from '@/stores/widgetStore';

// Floating star particle for background
function CosmosParticles({ count = 40 }: { count?: number }) {
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
    window.addEventListener('resize', resize);

    interface Star {
      x: number; y: number; r: number; alpha: number; speed: number; phase: number;
    }

    const w = window.innerWidth;
    const h = window.innerHeight;
    const stars: Star[] = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.5 + 0.3,
      alpha: Math.random(),
      speed: Math.random() * 0.3 + 0.1,
      phase: Math.random() * Math.PI * 2,
    }));

    let animId: number;
    let t = 0;

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      t += 0.01;

      for (const s of stars) {
        const flicker = 0.4 + 0.6 * Math.sin(t * s.speed * 5 + s.phase) ** 2;
        ctx.globalAlpha = s.alpha * flicker;
        ctx.fillStyle = '#D4A843';
        ctx.shadowColor = '#D4A843';
        ctx.shadowBlur = s.r * 4;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [count]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ width: '100%', height: '100%' }}
    />
  );
}

// Memory node — floating card for a RAG memory
function MemoryNode({
  title,
  content,
  time,
  projectColor,
  delay = 0,
}: {
  title: string;
  content: string;
  time?: string;
  projectColor?: string;
  delay?: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={cn(
        'transition-all duration-700 ease-out',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      )}
    >
      <div
        className="rounded-2xl p-4 backdrop-blur-xl border"
        style={{
          background: 'hsla(var(--glass-bg))',
          borderColor: projectColor
            ? `${projectColor}30`
            : 'hsla(var(--glass-border))',
          boxShadow: 'var(--glass-shadow)',
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-2 h-2 rounded-full mt-1.5 shrink-0"
            style={{
              backgroundColor: projectColor || 'hsl(var(--primary))',
              boxShadow: `0 0 8px ${projectColor || 'hsl(43, 74%, 55%)'}60`,
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[11px] font-medium text-[hsl(var(--primary))] truncate">
                {title}
              </span>
              {time && (
                <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0">
                  {time}
                </span>
              )}
            </div>
            <p className="text-[13px] text-[hsl(var(--foreground))] leading-relaxed line-clamp-3">
              {content}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CosmosHome() {
  const { events, projects, currentUser } = useAppStore();
  const { setMobileView } = useWidgetStore();
  const { language } = useTranslation();
  const locale = language === 'ko' ? ko : enUS;

  // Today's events
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

  // Build memory nodes from today's events + projects
  const memoryNodes = useMemo(() => {
    const nodes: Array<{
      id: string;
      title: string;
      content: string;
      time?: string;
      projectColor?: string;
    }> = [];

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

    // If no events, show a greeting
    if (nodes.length === 0) {
      nodes.push({
        id: 'greeting',
        title: language === 'ko' ? '오늘의 우주' : 'Your Cosmos',
        content: language === 'ko'
          ? '오늘 예정된 일정이 없습니다. 새로운 별을 만들어보세요.'
          : 'No events today. Create a new star.',
      });
    }

    return nodes;
  }, [todayEvents, projects, language]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const name = currentUser?.name?.split(' ')[0] || '';
    if (hour < 12) return language === 'ko' ? `좋은 아침, ${name}` : `Good morning, ${name}`;
    if (hour < 18) return language === 'ko' ? `좋은 오후, ${name}` : `Good afternoon, ${name}`;
    return language === 'ko' ? `좋은 저녁, ${name}` : `Good evening, ${name}`;
  }, [currentUser, language]);

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Background particles */}
      <CosmosParticles />

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        <div className="p-5 pt-12 space-y-6 pb-8">
          {/* Greeting + Date */}
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
              {greeting}
            </h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {format(new Date(), language === 'ko' ? 'yyyy년 M월 d일 EEEE' : 'EEEE, MMMM d', { locale })}
            </p>
          </div>

          {/* AI Insight — 기억할 한마디 */}
          <div
            className="rounded-2xl p-4 backdrop-blur-xl border"
            style={{
              background: 'linear-gradient(135deg, hsla(43, 74%, 55%, 0.08), hsla(43, 74%, 55%, 0.02))',
              borderColor: 'hsla(43, 74%, 55%, 0.15)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-[hsl(var(--primary))]" />
              <span className="text-[12px] font-semibold text-[hsl(var(--primary))]">
                {language === 'ko' ? 'AI의 한마디' : 'AI Insight'}
              </span>
            </div>
            <p className="text-[13px] text-[hsl(var(--foreground))] leading-relaxed">
              {todayEvents.length > 0
                ? (language === 'ko'
                  ? `오늘 ${todayEvents.length}개의 일정이 있습니다. 첫 번째는 ${todayEvents[0].title}이에요.`
                  : `You have ${todayEvents.length} events today. First up: ${todayEvents[0].title}.`)
                : (language === 'ko'
                  ? '오늘은 여유로운 하루네요. 창의적인 시간을 가져보세요. ✨'
                  : 'A free day ahead. Make it creative. ✨')
              }
            </p>
          </div>

          {/* Time Machine — Memory Nodes */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-1 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))]"
                style={{ boxShadow: 'var(--cosmos-star-glow)' }} />
              <span className="text-[12px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                {language === 'ko' ? '오늘의 타임라인' : 'Today\'s Timeline'}
              </span>
            </div>

            {/* Vertical timeline line */}
            <div className="relative pl-4">
              <div
                className="absolute left-[7px] top-0 bottom-0 w-px"
                style={{
                  background: 'linear-gradient(to bottom, hsl(var(--primary)) 0%, transparent 100%)',
                  opacity: 0.2,
                }}
              />

              <div className="space-y-3">
                {memoryNodes.map((node, i) => (
                  <MemoryNode
                    key={node.id}
                    title={node.title}
                    content={node.content}
                    time={node.time}
                    projectColor={node.projectColor}
                    delay={i * 150}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Brain AI Quick Access */}
          <button
            onClick={() => setMobileView('chat')}
            className="w-full rounded-2xl p-4 backdrop-blur-xl border flex items-center gap-3 active:scale-[0.98] transition-transform"
            style={{
              background: 'hsla(var(--glass-bg))',
              borderColor: 'hsla(var(--glass-border))',
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary)), hsla(43, 85%, 70%, 0.8))',
              }}
            >
              <MessageSquare className="w-5 h-5 text-black" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                Brain AI
              </p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                {language === 'ko' ? 'AI와 대화하기' : 'Chat with AI'}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default CosmosHome;
