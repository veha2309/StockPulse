"use client";
import { useEffect, useRef, memo } from "react";

const NeuralBackground = memo(function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let raf: number;
    let nodes: { x: number; y: number; vx: number; vy: number; r: number; alpha: number; pulse: number }[] = [];

    const resize = () => {
      if (!canvas) return;
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });

    // Detect dark mode for color choices
    const isDark = () => document.documentElement.classList.contains("dark");

    // Generate sparse, slow-moving nodes
    const NODE_COUNT = 5;
    nodes = Array.from({ length: NODE_COUNT }, () => ({
      x:     Math.random() * window.innerWidth,
      y:     Math.random() * window.innerHeight,
      vx:    (Math.random() - 0.5) * 0.2,
      vy:    (Math.random() - 0.5) * 0.2,
      r:     280 + Math.random() * 220,
      alpha: 0.06 + Math.random() * 0.08,
      pulse: Math.random() * Math.PI * 2,
    }));

    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.005;

      const dark = isDark();
      const primary = dark ? "99,102,241" : "79,70,229";
      const secondary = dark ? "79,70,229" : "99,102,241";

      nodes.forEach((n, i) => {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -n.r) n.x = canvas.width + n.r;
        if (n.x > canvas.width + n.r) n.x = -n.r;
        if (n.y < -n.r) n.y = canvas.height + n.r;
        if (n.y > canvas.height + n.r) n.y = -n.r;

        const pulse = Math.sin(t + n.pulse) * 0.5 + 0.5;
        const alpha = n.alpha * (0.5 + pulse * 0.5);

        const color = i % 2 === 0 ? primary : secondary;
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        grad.addColorStop(0,   `rgba(${color}, ${alpha})`);
        grad.addColorStop(0.5, `rgba(${color}, ${alpha * 0.3})`);
        grad.addColorStop(1,   `rgba(${color}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-background transition-colors duration-700 contain-strict">
      {/* Canvas-based soft orbs — GPU-composited, no blur cost */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full opacity-90 will-change-opacity"
        style={{ mixBlendMode: "normal" }}
      />

      {/* Grid texture — ultra-subtle */}
      <div
        className="absolute inset-0 opacity-[0.025] dark:opacity-[0.055]"
        style={{
          backgroundImage: `
            linear-gradient(var(--border) 1px, transparent 1px),
            linear-gradient(90deg, var(--border) 1px, transparent 1px)
          `,
          backgroundSize: "56px 56px",
        }}
      />

      {/* Ambient glow spots (CSS, not animated, zero cost) */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/5 rounded-full dark:bg-primary/8 blur-3xl opacity-60" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-violet-500/5 rounded-full dark:bg-violet-500/8 blur-3xl opacity-60" />
    </div>
  );
});

export default NeuralBackground;

