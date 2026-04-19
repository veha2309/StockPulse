"use client";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Moon, Clock } from "lucide-react";
import CandlestickChart from "./CandlestickChart";
import { cn } from "@/lib/utils";
import type { ChartPoint, CandlePoint } from "@/lib/types";

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-premium rounded-2xl px-4 py-3 shadow-2xl border-primary/20 bg-background/80">
      <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1 opacity-60">{label}</p>
      <p className="text-foreground font-black text-lg tabular-nums">₹{payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
    </div>
  );
}

const MarketClosed = () => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col items-center justify-center h-full gap-4 text-center px-8"
  >
    <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-3xl shadow-inner">
      <Moon className="text-muted-foreground/40" />
    </div>
    <div>
      <p className="text-foreground text-sm font-black uppercase tracking-[0.2em] mb-2 leading-none">Market Halted</p>
      <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest leading-relaxed">
        Trading hours: 09:15 – 15:30 IST<br/>
        <span className="opacity-50">Real-time telemetry paused</span>
      </p>
    </div>
  </motion.div>
);

type Props = {
  chartType: "area" | "candle";
  setChartType: (t: "area" | "candle") => void;
  chartData: ChartPoint[];
  candleData: CandlePoint[];
  loading: boolean;
  accent: string;
  isPositive: boolean;
};

export default function ChartArea({ chartType, setChartType, chartData, candleData, loading, accent, isPositive }: Props) {
  return (
    <div className="flex-1 px-2 sm:px-10 py-2 sm:py-6 overflow-hidden flex flex-col relative">
      <div className="flex items-center justify-between mb-2 sm:mb-6 flex-shrink-0 z-10">
        <div className="flex bg-secondary p-1 rounded-xl sm:rounded-2xl border border-border shadow-inner">
          <button 
            onClick={() => setChartType("area")}   
            className={cn(
               "px-3 sm:px-6 py-1.5 sm:py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg sm:rounded-xl transition-all",
               chartType === "area" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Area View
          </button>
          <button 
            onClick={() => setChartType("candle")} 
            className={cn(
               "px-3 sm:px-6 py-1.5 sm:py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg sm:rounded-xl transition-all",
               chartType === "candle" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:text-foreground"
            )}
          >
            CandleStick
          </button>
        </div>
        
        <div className="hidden xs:flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-background/50 border border-border/50 shadow-sm">
           <Activity size={12} className="text-primary sm:w-3.5 sm:h-3.5" />
           <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-muted-foreground">Neural</span>
        </div>
      </div>

      <div className="flex-1 rounded-[2.5rem] overflow-hidden border border-border bg-background/10 glass-premium relative group min-h-[300px] sm:min-h-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
        
        {loading ? (
          <div className="w-full h-full p-2 sm:p-5 lg:p-8 flex flex-col justify-end relative z-10 animate-pulse overflow-hidden">
             {/* Stencil Grid Pattern */}
             <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
             
             {/* Stencil chart shape */}
             <div className="absolute inset-0 flex items-end gap-1 px-8 pb-8 opacity-20">
               {Array.from({ length: 30 }).map((_, i) => (
                  <div key={i} className="flex-1 rounded-t-sm bg-primary/40" style={{ height: `${20 + Math.abs(Math.sin(i * 0.5) * 60)}%` }} />
               ))}
             </div>
             
             {/* Gradient Overlay for the stencil */}
             <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/10" />
             
             {/* Loading text stencil */}
             <div className="text-center relative z-20 mb-10">
               <div className="w-48 h-3 bg-primary/20 rounded-full mx-auto mb-3" />
               <div className="w-32 h-2 bg-muted/60 rounded-full mx-auto" />
             </div>
          </div>
        ) : (
          <div key={chartType} className="w-full h-full p-2 sm:p-5 lg:p-8 relative z-10">
            {chartType === "candle" ? (
              candleData.length === 0 ? <MarketClosed /> : <CandlestickChart data={candleData} isPositive={isPositive} />
            ) : chartData.length === 0 ? <MarketClosed /> : (
              <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                <AreaChart data={chartData} margin={{ top: 20, right: 0, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={accent} stopOpacity={0.4} />
                      <stop offset="90%" stopColor={accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="currentColor" className="text-muted-foreground/5" vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fill: "currentColor", fontSize: 11, fontWeight: 900 }} 
                    className="text-muted-foreground/60 uppercase tracking-widest"
                    interval="preserveStartEnd" 
                    axisLine={false} 
                    tickLine={false} 
                    dy={15}
                  />
                  <YAxis 
                    domain={["auto", "auto"]} 
                    tick={{ fill: "currentColor", fontSize: 11, fontWeight: 900 }} 
                    className="text-muted-foreground/60 tabular-nums"
                    tickFormatter={v => `₹${v.toLocaleString()}`} 
                    width={55} 
                    axisLine={false} 
                    tickLine={false} 
                    orientation="right" 
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: accent, strokeWidth: 1, strokeDasharray: "4 4" }} />
                  <Area 
                    type="monotone" 
                    dataKey="price" 
                    stroke={accent} 
                    strokeWidth={3} 
                    fill="url(#areaGrad)" 
                    dot={false} 
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
