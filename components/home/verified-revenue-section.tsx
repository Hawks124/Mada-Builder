"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRightIcon, QuestionIcon } from "@phosphor-icons/react";
import { VerifiedRevenueCard } from "./verified-revenue";
import { CommentCaMarcheModal } from "./how-it-work";

const MOCK_HISTORY_LONG = [
  { day: "01 Sep", revenue: 9400000 },
  { day: "03 Sep", revenue: 9800000 },
  { day: "05 Sep", revenue: 9500000 },
  { day: "07 Sep", revenue: 10200000 },
  { day: "09 Sep", revenue: 10700000 },
  { day: "11 Sep", revenue: 11000000 },
  { day: "13 Sep", revenue: 10800000 },
  { day: "15 Sep", revenue: 11400000 },
  { day: "17 Sep", revenue: 11900000 },
  { day: "19 Sep", revenue: 12500000 },
];

const MOCK_PRODUCTS = [
  {
    appName: "Avotra HR",
    appTagline: "Gestion RH pour les PME malgaches.",
    appInitials: "AH",
    appIconGradient: "from-sky-500 to-blue-600",
    makerName: "Ravo Andrian",
    makerAvatar: "https://i.pravatar.cc/150?u=m1",
    provider: "Stripe" as const,
    mrr: 12500000,
    arr: 150000000,
    activeSubscribers: 482,
    lastSyncedText: "il y a 12 min",
    historyData: MOCK_HISTORY_LONG,
  },
  {
    appName: "RunScript",
    appTagline: "Practice, Solve, Build directly in browser.",
    appInitials: "RS",
    appIconGradient: "from-emerald-400 to-teal-500",
    makerName: "John Benedict",
    makerAvatar: "https://i.pravatar.cc/150?u=m3",
    provider: "RevenueCat" as const,
    mrr: 4200000,
    arr: 50400000,
    activeSubscribers: 193,
    lastSyncedText: "il y a 1h",
    historyData: MOCK_HISTORY_LONG.slice(3),
  },
  {
    appName: "ZenHabits",
    appTagline: "Track your habits like a monk.",
    appInitials: "ZH",
    appIconGradient: "from-zinc-600 to-zinc-900",
    makerName: "Tee Jay",
    makerAvatar: "https://i.pravatar.cc/150?u=m11",
    provider: "Stripe" as const,
    mrr: 1800000,
    arr: 21600000,
    activeSubscribers: 87,
    lastSyncedText: "il y a 2h",
    historyData: MOCK_HISTORY_LONG.slice(5),
  },
];

export function VerifiedRevenueSection() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <section className="container px-4 md:px-8 max-w-7xl mx-auto w-full pt-16 pb-24">
      {/* ── SECTION HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl md:text-[2.5rem] font-extrabold tracking-tighter text-foreground leading-none">
            {/* La preuve par les chiffres */}
            Ils buildent. Ils prouvent.
          </h2>
          <p className="text-muted-foreground font-medium md:text-lg tracking-tight mt-1">
            Des makers malgaches qui génèrent de vrais revenus — vérifiés,
            transparents, impossibles à truquer.
          </p>
        </div>

        <div className="flex items-center gap-5 shrink-0">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <QuestionIcon weight="bold" className="w-4 h-4" />
            Comment ça marche ?
          </button>
          <Link
            href="/revenue"
            className="group flex items-center gap-2 text-sm font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
          >
            Classement MRR
            <ArrowRightIcon
              weight="bold"
              className="w-4 h-4 group-hover:translate-x-1 transition-transform"
            />
          </Link>
        </div>
      </div>

      <CommentCaMarcheModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* ── CARDS GRID — 3 colonnes égales, gap cohérent avec Newest ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_PRODUCTS.map((p) => (
          <VerifiedRevenueCard key={p.appName} {...p} currency="Ar" />
        ))}
      </div>

      {/* ── BOTTOM CTA EDITORIAL ── */}
      <div className="flex items-center justify-center mt-10 gap-4">
        <div className="h-px flex-1 bg-border/40" />
        <Link
          href="/revenue"
          className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
        >
          Voir tous les{" "}
          <span className="text-foreground">produits vérifiés</span> →
        </Link>
        <div className="h-px flex-1 bg-border/40" />
      </div>
    </section>
  );
}
