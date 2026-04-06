"use client";
import { useEffect, useRef } from "react";
import type { CandlePoint } from "@/lib/types";

export default function CandlestickChart({ data }: { data: CandlePoint[]; isPositive: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<import("lightweight-charts").IChartApi | null>(null);
  const roRef        = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!containerRef.current || !data.length) return;
    import("lightweight-charts").then(({ createChart, ColorType, CandlestickSeries }) => {
      if (!containerRef.current) return;
      chartRef.current = createChart(containerRef.current, {
        layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#374151" },
        grid: { vertLines: { color: "rgba(255,255,255,0.03)" }, horzLines: { color: "rgba(255,255,255,0.03)" } },
        timeScale: { timeVisible: true, secondsVisible: false, borderColor: "rgba(255,255,255,0.06)" },
        rightPriceScale: { borderColor: "rgba(255,255,255,0.06)" },
        width:  containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
      const series = chartRef.current.addSeries(CandlestickSeries, {
        upColor: "#34d399", downColor: "#f87171",
        borderUpColor: "#34d399", borderDownColor: "#f87171",
        wickUpColor: "#34d399", wickDownColor: "#f87171",
      });
      series.setData(data.map(d => ({
        time: d.time as import("lightweight-charts").UTCTimestamp,
        open: d.open, high: d.high, low: d.low, close: d.close,
      })));
      chartRef.current.timeScale().fitContent();

      roRef.current = new ResizeObserver(() => {
        if (chartRef.current && containerRef.current)
          chartRef.current.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      });
      roRef.current.observe(containerRef.current);
    });
    return () => {
      roRef.current?.disconnect(); roRef.current = null;
      chartRef.current?.remove();  chartRef.current = null;
    };
  }, [data]);

  return <div ref={containerRef} className="w-full h-full" />;
}
