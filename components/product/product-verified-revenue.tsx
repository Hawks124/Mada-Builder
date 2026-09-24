import { TrendUpIcon } from "@phosphor-icons/react";
import Image from "next/image";

export function ProductVerifiedRevenue() {
  return (
    <section className="relative flex flex-col gap-0 border-t border-border/40 pt-10 pb-4 my-4">
      
      {/* ── Subtle Background Glow ─────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 w-[800px] h-[400px] -translate-x-1/2 -translate-y-1/2 bg-emerald-500/5 blur-[100px] rounded-full dark:bg-emerald-500/10" />
      </div>

      {/* ── Section header ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-10">
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Revenus Vérifiés</h2>
        
        {/* Real RevenueCat Badge */}
        <span className="flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-widest text-[#F36262] dark:text-[#ff7878] border border-[#F36262]/30 bg-[#F36262]/5 dark:bg-[#F36262]/10 px-2.5 py-1 rounded-full shadow-sm">
          <Image src="/logos/revenuecat.svg" alt="RevenueCat" width={16} height={16} className="w-4 h-4 shrink-0" />
          RevenueCat
        </span>
        
        <span className="ml-auto text-[12px] font-medium text-muted-foreground mr-2">Actualisé il y a 2h</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end mb-10">
        {/* ── MRR Hero Number ────────────────────────────────────────── */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Revenu Mensuel Récurrent (MRR)</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-[5rem] md:text-[6rem] font-black tracking-tighter leading-none text-emerald-600 dark:text-emerald-400 drop-shadow-sm">
              $315
            </span>
            <span className="text-[2rem] md:text-[2.5rem] font-black text-emerald-600/40 dark:text-emerald-400/40 drop-shadow-sm">
              .00
            </span>
          </div>
        </div>

        {/* ── Area Chart (Mock 90-day growth) ─────────────────────────── */}
        <div className="w-full h-28 relative">
           <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
              <defs>
                 <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                 </linearGradient>
              </defs>
              {/* Grid lines (subtle) */}
              <line x1="0" y1="20" x2="300" y2="20" stroke="currentColor" className="text-border/40" strokeDasharray="3 3" />
              <line x1="0" y1="60" x2="300" y2="60" stroke="currentColor" className="text-border/40" strokeDasharray="3 3" />
              <line x1="0" y1="100" x2="300" y2="100" stroke="currentColor" className="text-border/40" strokeDasharray="3 3" />
              
              {/* Path Data representing consistent geometric growth */}
              <path 
                d="M 0 80 Q 25 70, 50 75 T 100 65 T 150 50 T 200 40 T 250 25 T 300 10 L 300 100 L 0 100 Z" 
                fill="url(#chartGradient)"
              />
              <path 
                d="M 0 80 Q 25 70, 50 75 T 100 65 T 150 50 T 200 40 T 250 25 T 300 10" 
                fill="none" 
                stroke="#10b981" 
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              
              {/* Final data point dot */}
              <circle cx="300" cy="10" r="4" fill="#10b981" stroke="white" strokeWidth="2" className="dark:stroke-background" />
           </svg>
        </div>
      </div>

      {/* ── Sub-metrics — 3-column grid ──────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-12 pt-8 border-t border-border/30">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">ARR Run Rate</span>
          <span className="text-xl md:text-2xl font-black tracking-tighter text-foreground">$3&thinsp;780</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Abonnés Actifs</span>
          <span className="text-xl md:text-2xl font-black tracking-tighter text-foreground">151</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Croissance mensuelle</span>
          <span className="text-xl md:text-2xl font-black tracking-tighter text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <TrendUpIcon weight="bold" className="w-5 h-5 -mt-0.5" />+6%
          </span>
        </div>
      </div>

    </section>
  );
}
