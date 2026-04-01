"use client";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import CandlestickChart from "./CandlestickChart";
import type { ChartPoint, CandlePoint } from "@/lib/types";

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs">
      <p className="text-gray-400 mb-0.5">{label}</p>
      <p className="text-white font-bold text-sm">₹{payload[0].value.toFixed(2)}</p>
    </div>
  );
}

const MarketClosed = () => (
  <div className="flex flex-col items-center justify-center h-full gap-2">
    <span className="text-5xl">🌙</span>
    <p className="text-gray-300 font-semibold mt-2">Market Closed</p>
    <p className="text-gray-600 text-sm">Trading hours: 9:15 AM – 3:30 PM IST</p>
  </div>
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
    <div className="flex-1 px-3 sm:px-6 py-4 sm:py-5 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex bg-black/30 p-1 rounded-xl border border-white/[0.06]">
          <button onClick={() => setChartType("area")}   className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${chartType === "area"   ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}>Area</button>
          <button onClick={() => setChartType("candle")} className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${chartType === "candle" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}>Candlestick</button>
        </div>
      </div>

      <div className="flex-1 rounded-2xl overflow-hidden" style={{ background: "rgba(0,0,0,0.2)" }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-600 text-sm">Fetching market data...</p>
          </div>
        ) : (
          <div key={chartType} className="w-full h-full animate-chartDissolve">
            {chartType === "candle" ? (
              candleData.length === 0 ? <MarketClosed /> : <CandlestickChart data={candleData} isPositive={isPositive} />
            ) : chartData.length === 0 ? <MarketClosed /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={accent} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fill: "#374151", fontSize: 10 }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                  <YAxis domain={["auto", "auto"]} tick={{ fill: "#374151", fontSize: 10 }} tickFormatter={v => `₹${v.toFixed(0)}`} width={60} axisLine={false} tickLine={false} orientation="right" />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="price" stroke={accent} strokeWidth={2} fill="url(#areaGrad)" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
