import { Activity, ArrowUpRight } from "lucide-react";
import ThemeToggle from "@/components/ui/ThemeToggle";

export default function AuthCard({ children, title, sub }: {
  children: React.ReactNode; icon: string; title: string; sub: string;
}) {
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <div className="auth-wordmark"><span className="auth-mark"><Activity size={21} /></span>StockPulse</div>
        <div>
          <span className="text-xs font-medium text-primary">YOUR MARKET WORKSPACE</span>
          <h1>A clearer view.<br />A considered move.</h1>
          <p>Follow the Indian markets, explore opportunities, and build your investing confidence in one focused workspace.</p>
          <div className="mt-10 flex items-center gap-3 text-sm text-foreground"><ArrowUpRight size={18} className="text-primary" /> Explore. Practice. Understand.</div>
        </div>
        <footer className="auth-note"><span>Built for a better perspective.</span><span>Virtual trading</span></footer>
      </aside>
      <main className="auth-form-side">
        <div className="auth-theme"><ThemeToggle /></div>
        <div className="auth-form">
          <h2>{title}</h2>
          <p className="auth-sub">{sub}</p>
          {children}
          <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">A practice environment. Orders use virtual funds.</p>
        </div>
      </main>
    </div>
  );
}
