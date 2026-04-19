"use client";
import { useEffect, useRef, memo, useState } from "react";

const NeuralBackground = memo(function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile, { passive: true });
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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

    const isDark = () => document.documentElement.classList.contains("dark");

    // Dynamic node count based on device performance (approximated by mobile width)
    const mobile = window.innerWidth < 768;
    const NODE_COUNT = mobile ? 2 : 5;
    
    nodes = Array.from({ length: NODE_COUNT }, () => ({
      x:     Math.random() * window.innerWidth,
      y:     Math.random() * window.innerHeight,
      vx:    (Math.random() - 0.5) * (mobile ? 0.1 : 0.2), // Slower on mobile
      vy:    (Math.random() - 0.5) * (mobile ? 0.1 : 0.2),
      r:     mobile ? (200 + Math.random() * 100) : (280 + Math.random() * 220),
      alpha: mobile ? 0.04 : (0.06 + Math.random() * 0.08),
      pulse: Math.random() * Math.PI * 2,
    }));

    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += mobile ? 0.002 : 0.005;

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
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full opacity-90 will-change-opacity"
        style={{ mixBlendMode: "normal" }}
      />

      <div
        className="absolute inset-0 opacity-[0.025] dark:opacity-[0.055]"
        style={{
          backgroundImage: `
            linear-gradient(var(--border) 1px, transparent 1px),
            linear-gradient(90deg, var(--border) 1px, transparent 1px)
          `,
          backgroundSize: isMobile ? "40px 40px" : "56px 56px",
        }}
      />

      {/* Simplified ambient spots for mobile */}
      <div className="absolute -top-32 -left-32 w-64 h-64 sm:w-96 sm:h-96 bg-primary/5 rounded-full dark:bg-primary/8 blur-3xl opacity-60" />
      {!isMobile && (
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-violet-500/5 rounded-full dark:bg-violet-500/8 blur-3xl opacity-60" />
      )}
    </div>
  );
});

export default NeuralBackground;


