/**
 * ConstellationMap — 별자리 관계맵 (Vercel-minimal + gold stars)
 *
 * 별 = 금색(유일한 컬러 포인트), UI 텍스트 = 흑백
 * 대화 빈도 기반 거리, 누적 대화량 기반 크기
 */

import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useWidgetStore } from '@/stores/widgetStore';
import { useTranslation } from '@/hooks/useTranslation';
import { subDays } from 'date-fns';

interface StarData {
  userId: string;
  name: string;
  recentCount: number;
  totalCount: number;
  angle: number;
  distance: number;
  size: number;
}

export function ConstellationMap() {
  const { currentUser, users, messages } = useAppStore();
  const { setMobileView } = useWidgetStore();
  const { language } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ w: 0, h: 0 });
  const [tappedStar, setTappedStar] = useState<StarData | null>(null);
  const starsRef = useRef<StarData[]>([]);

  const stars = useMemo(() => {
    if (!currentUser) return [];
    const weekAgo = subDays(new Date(), 7);
    const otherUsers = users.filter(u => u.id !== currentUser.id);

    const userStats = otherUsers.map(user => {
      const userMessages = messages.filter(m =>
        (m.userId === user.id || m.userId === currentUser.id) && m.roomType === 'dm'
      );
      const totalCount = userMessages.length;
      const recentCount = userMessages.filter(m => {
        try { return new Date(m.createdAt) >= weekAgo; } catch { return false; }
      }).length;
      return { userId: user.id, name: user.name, recentCount, totalCount };
    });

    const sorted = [...userStats].sort((a, b) => b.recentCount - a.recentCount);
    const maxRecent = Math.max(...sorted.map(s => s.recentCount), 1);
    const maxTotal = Math.max(...sorted.map(s => s.totalCount), 1);

    return sorted.map((s, i) => {
      const proximity = s.recentCount / maxRecent;
      const distance = 0.25 + (1 - proximity) * 0.65;
      const sizeNorm = s.totalCount / maxTotal;
      const size = 2.5 + sizeNorm * 5;
      const baseAngle = (i / sorted.length) * Math.PI * 2;
      const jitter = (Math.random() - 0.5) * 0.3;
      return { ...s, angle: baseAngle + jitter, distance, size } as StarData;
    });
  }, [currentUser, users, messages]);

  starsRef.current = stars;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ w: width, h: height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.w === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.w * dpr;
    canvas.height = dimensions.h * dpr;
    ctx.scale(dpr, dpr);

    const cx = dimensions.w / 2;
    const cy = dimensions.h / 2;
    const maxR = Math.min(cx, cy) * 0.85;

    let animId: number;
    let t = 0;

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, dimensions.w, dimensions.h);
      t += 0.004;

      // Subtle orbit rings
      for (let ring = 0.3; ring <= 0.9; ring += 0.25) {
        ctx.beginPath();
        ctx.arc(cx, cy, ring * maxR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Center — me
      const glow = 0.6 + 0.4 * Math.sin(t * 2);
      ctx.globalAlpha = glow;
      ctx.fillStyle = '#D4A843';
      ctx.shadowColor = '#D4A843';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '500 10px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(language === 'ko' ? '나' : 'Me', cx, cy + 18);

      // Stars
      const currentStars = starsRef.current;
      for (const star of currentStars) {
        const sx = cx + Math.cos(star.angle + t * 0.08) * star.distance * maxR;
        const sy = cy + Math.sin(star.angle + t * 0.08) * star.distance * maxR;

        // Connection line
        const lineAlpha = Math.max(0.01, (1 - star.distance) * 0.08);
        ctx.strokeStyle = `rgba(212, 168, 67, ${lineAlpha})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(sx, sy);
        ctx.stroke();

        // Star dot
        const flicker = 0.4 + 0.6 * Math.sin(t * 3 + star.angle);
        ctx.globalAlpha = 0.3 + 0.7 * flicker;
        ctx.fillStyle = '#D4A843';
        ctx.shadowColor = '#D4A843';
        ctx.shadowBlur = star.size * 2;
        ctx.beginPath();
        ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        // Name
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.font = '500 9px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(star.name, sx, sy + star.size + 13);
      }

      animId = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animId);
  }, [dimensions, stars, language]);

  const handleTap = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const tapX = clientX - rect.left;
    const tapY = clientY - rect.top;
    const cx = dimensions.w / 2;
    const cy = dimensions.h / 2;
    const maxR = Math.min(cx, cy) * 0.85;

    for (const star of starsRef.current) {
      const sx = cx + Math.cos(star.angle) * star.distance * maxR;
      const sy = cy + Math.sin(star.angle) * star.distance * maxR;
      const dist = Math.sqrt((tapX - sx) ** 2 + (tapY - sy) ** 2);
      if (dist < Math.max(star.size + 12, 24)) {
        setTappedStar(star);
        return;
      }
    }
    setTappedStar(null);
  }, [dimensions]);

  return (
    <div ref={containerRef} className="relative flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 px-6 pt-14">
        <h1 className="text-lg font-bold text-white tracking-tight">
          {language === 'ko' ? '관계' : 'People'}
        </h1>
        <p className="text-[11px] text-white/25 mt-0.5">
          {language === 'ko'
            ? '가까울수록 최근 대화가 많은 사람'
            : 'Closer = more recent conversations'}
        </p>
      </div>

      <canvas
        ref={canvasRef}
        className="flex-1"
        style={{ width: '100%', height: '100%' }}
        onClick={handleTap}
        onTouchStart={handleTap}
      />

      {/* Tap popup */}
      {tappedStar && (
        <div className="absolute bottom-24 left-4 right-4 z-30 animate-fade-in">
          <div
            className="rounded-xl p-4 border"
            style={{
              background: 'rgb(10, 10, 10)',
              borderColor: 'rgba(255, 255, 255, 0.06)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center text-sm font-semibold">
                {tappedStar.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-white">{tappedStar.name}</p>
                <p className="text-[11px] text-white/30">
                  {language === 'ko'
                    ? `최근 7일 ${tappedStar.recentCount}회 대화`
                    : `${tappedStar.recentCount} messages (7d)`}
                </p>
              </div>
              <button
                onClick={() => { setMobileView('chat'); setTappedStar(null); }}
                className="px-4 py-1.5 rounded-full text-[11px] font-medium bg-white text-black"
              >
                {language === 'ko' ? '채팅' : 'Chat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConstellationMap;
