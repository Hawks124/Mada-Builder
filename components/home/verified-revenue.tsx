"use client";

import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import Link from "next/link";
import { SealCheckIcon, LockSimpleIcon } from "@phosphor-icons/react";
import { cn, slugifyName } from "@/lib/utils";

// Real provider logos stored in /public/logos/
const PROVIDER_LOGO: Record<"Stripe" | "RevenueCat", { src: string; color: string; label: string }> = {
  Stripe: {
    src: "/logos/stripe.svg",
    color: "#635BFF",
    label: "Stripe",
  },
  RevenueCat: {
    src: "/logos/revenuecat.svg",
    color: "#F5820D",
    label: "RevenueCat",
  },
};

interface RevenueDataPoint {
  day: string;
  revenue: number;
}

interface VerifiedRevenueCardProps {
  /* App */
  appName: string;
  appTagline: string;
  appInitials: string;
  appIconGradient: string;
  /* Maker */
  makerName: string;
  makerAvatar: string;
  makerVerified?: boolean;
  /* Revenue */
  provider: "Stripe" | "RevenueCat";
  mrr: number;
  arr: number;
  activeSubscribers: number;
  lastSyncedText: string;
  historyData: RevenueDataPoint[];
  currency?: string;
  className?: string;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toLocaleString("fr-FR");
}

export function VerifiedRevenueCard({
  appName,
  appTagline,
  appInitials,
  appIconGradient,
  makerName,
  makerAvatar,
  makerVerified = true,
  provider,
  mrr,
  arr,
  activeSubscribers,
  lastSyncedText,
  historyData,
  currency = "Ar",
  className,
}: VerifiedRevenueCardProps) {
  const first = historyData[0]?.revenue ?? 0;
  const last = historyData[historyData.length - 1]?.revenue ?? 0;
  const delta = last - first;
  const pct = first > 0 ? ((delta / first) * 100).toFixed(1) : "0.0";
  const isUp = delta >= 0;

  return (
    <div
      className={cn(
        "group flex flex-col bg-muted/30 hover:bg-muted/60 rounded-4xl transition-all duration-300 overflow-hidden border border-transparent hover:border-border/40 hover:shadow-lg",
        className
      )}
    >
      {/* ── HEADER : App icon + provider badge ── */}
      <div className="flex items-start justify-between gap-3 p-6 pb-4">
        {/* App Squircle — same pattern as Ghost Cards */}
        <div
          className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-base bg-linear-to-br shadow-sm shrink-0 transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-2",
            appIconGradient
          )}
        >
          {appInitials}
        </div>

        {/* Provider badge — real logo + brand label */}
        <div className="flex items-center gap-1.5 pt-0.5">
          <img
            src={PROVIDER_LOGO[provider].src}
            alt={PROVIDER_LOGO[provider].label}
            className="h-4 w-auto object-contain"
          />
          <span
            className="text-[9px] font-black uppercase tracking-widest"
            style={{ color: PROVIDER_LOGO[provider].color }}
          >
            Vérifié
          </span>
          <span className="text-[9px] text-muted-foreground font-medium">
            · {lastSyncedText}
          </span>
        </div>
      </div>

      {/* ── APP NAME + TAGLINE ── */}
      <div className="flex flex-col gap-0.5 px-6">
        <h3 className="text-lg font-extrabold tracking-tight text-foreground leading-none line-clamp-1">
          {appName}
        </h3>
        <p className="text-[13px] text-muted-foreground font-medium line-clamp-1">
          {appTagline}
        </p>
      </div>

      {/* ── MRR HERO ── */}
      <div className="flex items-end justify-between gap-2 px-6 pt-5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            MRR
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-black tracking-tighter text-foreground tabular-nums leading-none">
              {formatCompact(mrr)}
            </span>
            <span className="text-base font-bold text-muted-foreground">
              {currency}
            </span>
          </div>
        </div>

        <span
          className={cn(
            "text-sm font-black mb-1",
            isUp ? "text-emerald-600" : "text-red-500"
          )}
        >
          {isUp ? "▲" : "▼"} {pct}%
        </span>
      </div>

      {/* ── SECONDARY METRICS ── no boxes, only whitespace */}
      <div className="flex items-center gap-6 px-6 pt-3 pb-2">
        <div className="flex flex-col gap-0">
          <span className="text-sm font-extrabold text-foreground tabular-nums">
            {formatCompact(arr)} {currency}
          </span>
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            ARR
          </span>
        </div>
        <div className="w-px h-7 bg-border/50" />
        <div className="flex flex-col gap-0">
          <span className="text-sm font-extrabold text-foreground tabular-nums">
            {activeSubscribers.toLocaleString("fr-FR")}
          </span>
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            Abonnés
          </span>
        </div>
      </div>

      {/* ── SPARKLINE CHART ── */}
      <div className="w-full h-28 mt-2 rounded-b-4xl">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={historyData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${appName.replace(/\s+/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Tooltip
              contentStyle={{
                background: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "10px",
                fontSize: "12px",
                fontWeight: "700",
                color: "hsl(var(--foreground))",
              }}
              itemStyle={{ color: "#10b981" }}
              labelStyle={{ color: "hsl(var(--muted-foreground))", fontSize: "10px" }}
              formatter={(v) =>
                v !== undefined
                  ? [`${formatCompact(Number(v))} ${currency}`, "MRR"]
                  : ["—", "MRR"]
              }
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#10b981"
              strokeWidth={1.5}
              fill={`url(#grad-${appName.replace(/\s+/g, "-")})`}
              dot={false}
              isAnimationActive
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── FOOTER : Maker + lock disclaimer ── */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border/20">
        {/* Maker row — same pattern as Leaderboard & Ghost Cards */}
        <Link
          href={`/makers/${slugifyName(makerName)}`}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity w-fit"
        >
          <img
            src={makerAvatar}
            alt={makerName}
            className="w-6 h-6 rounded-full grayscale group-hover:grayscale-0 transition-all"
          />
          <span className="text-xs font-bold text-foreground">{makerName}</span>
          {makerVerified && (
            <SealCheckIcon weight="fill" className="w-3.5 h-3.5 text-blue-500 -ml-1" />
          )}
        </Link>

        {/* Infalsifiable micro-disclaimer */}
        <div className="flex items-center gap-1 text-muted-foreground/50">
          <LockSimpleIcon weight="fill" className="w-2.5 h-2.5 shrink-0" />
          <span className="text-[9px] font-medium">Infalsifiable</span>
        </div>
      </div>
    </div>
  );
}
