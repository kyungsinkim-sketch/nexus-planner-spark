/**
 * CosmosHome — 모바일 랜딩 (Vercel-inspired minimal)
 *
 * 구조: Brain AI 입력 → 타임라인 (스크롤 없이 바로 보이게)
 */

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { format, parseISO, startOfDay, endOfDay, isBefore, isAfter } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { Sparkles, ArrowUp, Loader2 } from 'lucide-react';
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
    const dayStart = startOfDay(now); const dayEnd = endOfDay(now);
    return events
      .filter(e => { try { const s = parseISO(e.startAt); return !isBefore(s, dayStart) && !isAfter(s, dayEnd); } catch { return false; } })
      .sort((a, b) => a.startAt.localeCompare(b.startAt)).slice(0, 5);
  }, [events]);

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
      const { processMessageWithLLM } = await import('@/services/brainService');
      const userId = currentUser?.id || '';
      const result = await processMessageWithLLM({
        messageContent: msg,
        userId,
        chatMembers: [],
      });
      setBrainResponse(result.llmResponse?.replyMessage || (language === 'ko' ? '처리 완료' : 'Done'));
    } catch (err: unknown) {
      setBrainResponse(err instanceof Error ? err.message : (language === 'ko' ? '오류가 발생했습니다.' : 'An error occurred.'));
    } finally {
      setBrainLoading(false);
    }
  }, [brainInput, brainLoading, currentUser, language]);

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      <CosmosParticles />

      {/* Top section — Greeting + Brain AI (always visible, no scroll needed) */}
      <div className="relative z-10 shrink-0 px-6 pt-14 pb-3">
        {/* Greeting */}
        <h1 className="text-[26px] font-bold tracking-tight text-white">{greeting}</h1>
        <p className="text-[12px] text-white/20 mt-0.5 font-mono">
          {format(new Date(), language === 'ko' ? 'yyyy.MM.dd EEEE' : 'EEEE, MMMM d', { locale })}
        </p>

        {/* Brain AI Input — right below greeting */}
        <div className="mt-4">
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <Sparkles className="w-4 h-4 text-white/15 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={brainInput}
              onChange={e => setBrainInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleBrainSubmit()}
              placeholder={language === 'ko' ? 'Brain AI에게 물어보세요...' : 'Ask Brain AI...'}
              className="flex-1 bg-transparent text-[13px] text-white placeholder:text-white/15 outline-none"
              disabled={brainLoading}
            />
            {brainLoading ? (
              <Loader2 className="w-4 h-4 text-white/30 animate-spin" />
            ) : brainInput.trim() ? (
              <button onClick={handleBrainSubmit}
                className="w-6 h-6 rounded-md flex items-center justify-center bg-white text-black">
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>

          {/* Brain response */}
          {brainResponse && (
            <div className="mt-2 px-3.5 py-2.5 rounded-xl border border-white/[0.04] bg-white/[0.01]">
              <p className="text-[13px] text-white/60 leading-relaxed whitespace-pre-wrap">{brainResponse}</p>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable timeline below */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        <div className="px-6 pb-8">
          {/* AI Insight */}
          {todayEvents.length > 0 && (
            <div className="flex items-start gap-2 mb-4">
              <Sparkles className="w-3 h-3 text-[#D4A843] mt-0.5 shrink-0" />
              <p className="text-[12px] text-white/35 leading-relaxed">
                {language === 'ko'
                  ? `오늘 ${todayEvents.length}개 일정. ${todayEvents[0].title}부터.`
                  : `${todayEvents.length} events. Starting with ${todayEvents[0].title}.`}
              </p>
            </div>
          )}

          {/* Timeline */}
          <p className="text-[10px] text-white/15 uppercase tracking-[0.15em] font-medium mb-3">
            {language === 'ko' ? '타임라인' : 'Timeline'}
          </p>
          <div className="space-y-2">
            {todayEvents.length === 0 ? (
              <div className="rounded-lg p-3 border border-dashed border-white/[0.04]">
                <p className="text-[12px] text-white/15 text-center">
                  {language === 'ko' ? '오늘 일정 없음' : 'No events today'}
                </p>
              </div>
            ) : (
              todayEvents.map((event, i) => {
                const project = projects.find(p => p.id === event.projectId);
                return (
                  <div key={event.id}
                    className="rounded-lg p-3 border border-white/[0.04] bg-white/[0.01] animate-fade-in"
                    style={{ animationDelay: `${i * 100}ms` }}>
                    <div className="flex items-start gap-2.5">
                      <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: project?.keyColor || '#fff' }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-white/30 truncate">{project?.title || ''}</span>
                          <span className="text-[10px] text-white/15 font-mono">{format(parseISO(event.startAt), 'HH:mm')}</span>
                        </div>
                        <p className="text-[13px] text-white/70 mt-0.5">{event.title}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CosmosHome;
