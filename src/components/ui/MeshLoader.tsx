/**
 * MeshLoader — Gold stars/dots loading animation.
 * Uses the Re-Be.io loading-stars.jpg image.
 * Each golden particle fades in and out sequentially for an elegant loading effect.
 */

import { useRef, useEffect } from 'react';

interface MeshLoaderProps {
  size?: number;
  message?: string;
}

// Approximate positions of the 10 gold dots/stars from the image (normalized 0-1)
// Arranged roughly in a circle pattern
const PARTICLES = [
  { x: 0.42, y: 0.22, scale: 0.7, isStar: false },  // top-center-left
  { x: 0.58, y: 0.20, scale: 0.65, isStar: false }, // top-center-right
  { x: 0.30, y: 0.32, scale: 0.75, isStar: false }, // upper-left
  { x: 0.70, y: 0.30, scale: 0.7, isStar: false },  // upper-right
  { x: 0.22, y: 0.48, scale: 0.8, isStar: true },   // mid-left (star)
  { x: 0.78, y: 0.46, scale: 0.75, isStar: true },  // mid-right (star)
  { x: 0.25, y: 0.62, scale: 0.7, isStar: false },  // lower-left
  { x: 0.75, y: 0.60, scale: 0.7, isStar: false },  // lower-right
  { x: 0.40, y: 0.74, scale: 0.65, isStar: false }, // bottom-left
  { x: 0.60, y: 0.72, scale: 0.8, isStar: false },  // bottom-right
];

export function MeshLoader({ size = 200, message }: MeshLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const count = PARTICLES.length;
    // Each particle has its own phase offset for staggered animation
    const phases = PARTICLES.map((_, i) => (i / count) * Math.PI * 2);
    let animId: number;
    let startTime = performance.now();

    function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, alpha: number) {
      const spikes = 4;
      const outerR = r;
      const innerR = r * 0.4;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#D4A843';
      ctx.shadowColor = '#D4A843';
      ctx.shadowBlur = r * 2;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const radius = i % 2 === 0 ? outerR : innerR;
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function drawDot(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, alpha: number) {
      ctx.save();
      ctx.globalAlpha = alpha;
      // Gold gradient dot
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, '#F0D060');
      grad.addColorStop(0.5, '#D4A843');
      grad.addColorStop(1, 'rgba(180, 140, 50, 0)');
      ctx.fillStyle = grad;
      ctx.shadowColor = '#D4A843';
      ctx.shadowBlur = r * 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, size, size);

      const elapsed = (performance.now() - startTime) / 1000;
      // Cycle speed: each full cycle ~3 seconds
      const speed = 1.8;

      for (let i = 0; i < count; i++) {
        const p = PARTICLES[i];
        // Sine wave for fade in/out, offset by phase
        const raw = Math.sin(elapsed * speed + phases[i]);
        // Map from [-1,1] to [0,1], then apply easing for more dramatic appear/disappear
        const alpha = Math.max(0, raw) ** 0.8;

        if (alpha < 0.01) continue;

        const cx = p.x * size;
        const cy = p.y * size;
        const baseR = size * 0.03 * p.scale;
        // Slight scale pulse with alpha
        const r = baseR * (0.7 + 0.3 * alpha);

        if (p.isStar) {
          drawStar(ctx, cx, cy, r * 1.8, alpha);
        } else {
          drawDot(ctx, cx, cy, r, alpha);
        }
      }

      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animId);
  }, [size]);

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
      />
      {message && (
        <p className="text-amber-400/70 text-sm animate-pulse">{message}</p>
      )}
    </div>
  );
}
