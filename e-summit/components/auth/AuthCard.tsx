import Orbs from "@/components/ui/Orbs";

export default function AuthCard({ children, icon, title, sub }: {
  children: React.ReactNode; icon: string; title: string; sub: string;
}) {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <Orbs />
      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <span className="text-2xl">{icon}</span>
          <span className="text-xl font-bold gradient-text tracking-tight">StockPulse</span>
        </div>
        <div className="glass rounded-2xl p-7 animate-fadeInUp">
          <h2 className="text-xl font-bold text-white mb-1">{title}</h2>
          <p className="text-gray-500 text-sm mb-6">{sub}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
