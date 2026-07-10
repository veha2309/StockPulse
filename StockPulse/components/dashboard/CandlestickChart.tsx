"use client";
import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import type { CandlePoint } from "@/lib/types";

export default function CandlestickChart({ data }: { data: CandlePoint[]; isPositive: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<import("lightweight-charts").IChartApi | null>(null);
  const seriesRef    = useRef<import("lightweight-charts").ISeriesApi<"Candlestick"> | null>(null);
  const roRef        = useRef<ResizeObserver | null>(null);
  const { theme }    = useTheme();

  // 1. Initial Chart Setup
  useEffect(() => {
    if (!containerRef.current) return;

    let chart: import("lightweight-charts").IChartApi;

    import("lightweight-charts").then(({ createChart, ColorType, CandlestickSeries }) => {
      if (!containerRef.current) return;

      const isDark = theme === "dark";
      const colors = {
        background: "transparent",
        text: isDark ? "#94a3b8" : "#64748b",
        grid: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
        border: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
        accent: isDark ? "#3b82f6" : "#4f46e5",
      };

      chart = createChart(containerRef.current, {
        layout: { 
          background: { type: ColorType.Solid, color: colors.background }, 
          textColor: colors.text,
          fontSize: 10,
        },
        grid: { 
          vertLines: { color: colors.grid }, 
          horzLines: { color: colors.grid } 
        },
        timeScale: { 
          timeVisible: true, 
          secondsVisible: false, 
          borderColor: colors.border,
          tickMarkFormatter: (time : any)  => {
            if (typeof time === "number") {
              const date = new Date(time * 1000);
              return date.toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
              });
            }
            return String(time);
          }
        },
        rightPriceScale: { 
          borderColor: colors.border,
          autoScale: true,
        },
        localization: {
          timeFormatter: (time: any) => {
            if (typeof time === "number") {
              const date = new Date(time * 1000);
              return date.toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
              });
            }
            return String(time);
          }
        },
        crosshair: {
          mode: 0, // Magnet
          vertLine: { color: colors.accent, labelBackgroundColor: colors.accent },
          horzLine: { color: colors.accent, labelBackgroundColor: colors.accent },
        },
        width:  containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
        handleScale: {
          axisPressedMouseMove: { time: true, price: true },
          mouseWheel: true,
        },
        handleScroll: {
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true,
          mouseWheel: true,
        },
        trackingMode: {
          exitMode: 0, // OnNextTap
        },
      });

      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#10b981", 
        downColor: "#ef4444",
        borderUpColor: "#10b981", 
        borderDownColor: "#ef4444",
        wickUpColor: "#10b981", 
        wickDownColor: "#ef4444",
      });

      chartRef.current = chart;
      seriesRef.current = series;

      // Set initial data if available
      if (data.length) {
        series.setData(data.map(d => ({
          time: d.time as import("lightweight-charts").UTCTimestamp,
          open: d.open, high: d.high, low: d.low, close: d.close,
        })));
        chart.timeScale().fitContent();
      }

      roRef.current = new ResizeObserver(() => {
        if (chartRef.current && containerRef.current)
          chartRef.current.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      });
      roRef.current.observe(containerRef.current);
    });

    return () => {
      roRef.current?.disconnect();
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []); // Only on mount

  // 2. Data Updates (Optimized: No full re-render)
  useEffect(() => {
    if (seriesRef.current && data.length) {
      seriesRef.current.setData(data.map(d => ({
        time: d.time as import("lightweight-charts").UTCTimestamp,
        open: d.open, high: d.high, low: d.low, close: d.close,
      })));
    }
  }, [data]);

  // 3. Theme Updates
  useEffect(() => {
    if (chartRef.current) {
      const isDark = theme === "dark";
      const colors = {
        text: isDark ? "#94a3b8" : "#64748b",
        grid: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
        accent: isDark ? "#3b82f6" : "#4f46e5",
      };

      chartRef.current.applyOptions({
        layout: { textColor: colors.text },
        grid: { 
          vertLines: { color: colors.grid }, 
          horzLines: { color: colors.grid } 
        },
        crosshair: {
          vertLine: { color: colors.accent, labelBackgroundColor: colors.accent },
          horzLine: { color: colors.accent, labelBackgroundColor: colors.accent },
        },
      });
    }
  }, [theme]);

  return <div ref={containerRef} className="w-full h-full relative z-[5]" style={{ touchAction: "none" }} />;
}
