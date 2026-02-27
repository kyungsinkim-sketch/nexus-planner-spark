/**
 * ConstellationMap — 별자리 관계맵
 *
 * 다른 유저들이 별로 표현됨.
 * - 최근 대화 횟수가 많을수록 가까이 (중심 = 나)
 * - 별 크기 = 누적 대화량
 * - 클릭하면 채팅 팝업으로 이동
 */

import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useWidgetStore } from '@/stores/widgetStore';
import { useTranslation } from '@/hooks/useTranslation';
import { subDays } from 'date-fns';

interface StarData {
  userId: string;
  name: string;
  recentCount: number;  // recent 7-day messages
  totalCount: number;   // all-time messages
  angle: number;
  distance: number;     // 0=center, 1=edge
  size: number;         // star radius
  avatar?: string;
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

  // Calculate star positions based on message frequency
  const stars = useMemo(() => {
    if (!currentUser) return [];

    const now = new Date();
    const weekAgo = subDays(now, 7);

    // Other users (excluding self)
    const otherUsers = users.filter(u => u.id !== currentUser.id);

    // Count messages per user
    const userStats = otherUsers.map(user => {
      // DM messages between current user and this user
      const userMessages = messages.filter(m =>
        (m.userId === user.id || m.userId === currentUser.id) &&
        (m.roomType === 'dm')
      );

      // Count messages involving this user
      const totalCount = userMessages.filter(m =>
        m.userId === user.id || (m.roomType === 'dm')
      ).length;

      const recentCount = userMessages.filter(m => {
        try {
          return new Date(m.createdAt) >= weekAgo;
        } catch { return false; }
      }).length;

      return { userId: user.id, name: user.name, recentCount, totalCount };
    });

    // Sort by recent count desc for angle distribution
    const sorted = [...userStats].sort((a, b) => b.recentCount - a.recentCount);

    const maxRecent = Math.max(...sorted.map(s => s.recentCount), 1);
    const maxTotal = Math.max(...sorted.map(s => s.totalCount), 1);

    return sorted.map((s, i) => {
      // Distance: more recent messages = closer to center
      const proximity = s.recentCount / maxRecent; // 0~1, 1 = most messages
      const distance = 0.25 + (1 - proximity) * 0.65; // 0.25~0.9

      // Size: based on total message count
      const sizeNorm = s.totalCount / maxTotal;
      const size = 3 + sizeNorm * 6; // 3~9px radius

      // Angle: distribute evenly with some jitter
      const baseAngle = (i / sorted.length) * Math.PI * 2;
      const jitter = (Math.random() - 0.5) * 0.3;

      return {
        ...s,
        angle: baseAngle + jitter,
        distance,
        size,
      } as StarData;
    });
  }, [currentUser, users, messages]);

  starsRef.current = stars;

  // Measure container
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

  // Draw the constellation
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
      t += 0.005;

      // Draw subtle orbit rings
      for (let ring = 0.25; ring <= 0.9; ring += 0.2) {
        ctx.beginPath();
        ctx.arc(cx, cy, ring * maxR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(212, 168, 67, 0.04)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Draw center star (me)
      const centerGlow = 0.6 + 0.4 * Math.sin(t * 2);
      ctx.globalAlpha = centerGlow;
      ctx.fillStyle = '#D4A843';
      ctx.shadowColor = '#D4A843';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // "나" label
      ctx.fillStyle = 'rgba(212, 168, 67, 0.7)';
      ctx.font = '10px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(language === 'ko' ? '나' : 'Me', cx, cy + 18);

      // Draw connection lines + stars
      const currentStars = starsRef.current;
      for (const star of currentStars) {
        const sx = cx + Math.cos(star.angle + t * 0.1) * star.distance * maxR;
        const sy = cy + Math.sin(star.angle + t * 0.1) * star.distance * maxR;

        // Connection line to center
        const lineAlpha = Math.max(0.02, (1 - star.distance) * 0.12);
        ctx.strokeStyle = `rgba(212, 168, 67, ${lineAlpha})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(sx, sy);
        ctx.stroke();

        // Star glow
        const flicker = 0.5 + 0.5 * Math.sin(t * 3 + star.angle);
        ctx.globalAlpha = 0.3 + 0.7 * flicker;
        ctx.fillStyle = '#D4A843';
        ctx.shadowColor = '#D4A843';
        ctx.shadowBlur = star.size * 2;
        ctx.beginPath();
        ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        // Name label
        ctx.fillStyle = 'rgba(212, 168, 67, 0.6)';
        ctx.font = '10px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(star.name, sx, sy + star.size + 14);
      }

      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animId);
  }, [dimensions, stars, language]);

  // Handle tap on stars
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
    const t = 0; // approximate current time (close enough for tap detection)

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

  const handleChatWith = (userId: string) => {
    // TODO: open DM with this user
    setMobileView('chat');
    setTappedStar(null);
  };

  return (
    <div ref={containerRef} className="relative flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-5 pt-12">
        <h1 className="text-lg font-bold text-[hsl(var(--foreground))]">
          {language === 'ko' ? '나의 별자리' : 'My Constellation'}
        </h1>
        <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
          {language === 'ko'
            ? '가까운 별일수록 최근 많이 대화한 사람'
            : 'Closer stars = more recent conversations'}
        </p>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="flex-1"
        style={{ width: '100%', height: '100%' }}
        onClick={handleTap}
        onTouchStart={handleTap}
      />

      {/* Tapped star popup */}
      {tappedStar && (
        <div className="absolute bottom-24 left-4 right-4 z-30 animate-fade-in">
          <div
            className="rounded-2xl p-4 backdrop-blur-xl border"
            style={{
              background: 'hsla(var(--glass-bg))',
              borderColor: 'hsla(43, 74%, 55%, 0.15)',
              boxShadow: 'var(--glass-shadow)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--primary)), hsla(43, 85%, 70%, 0.8))',
                  color: 'hsl(var(--primary-foreground))',
                }}
              >
                {tappedStar.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{tappedStar.name}</p>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                  {language === 'ko'
                    ? `최근 7일 대화 ${tappedStar.recentCount}회`
                    : `${tappedStar.recentCount} messages (7d)`}
                </p>
              </div>
              <button
                onClick={() => handleChatWith(tappedStar!.userId)}
                className="px-4 py-2 rounded-full text-xs font-medium"
                style={{
                  background: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                }}
              >
                {language === 'ko' ? '대화하기' : 'Chat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConstellationMap;
