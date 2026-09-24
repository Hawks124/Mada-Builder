"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  XIcon,
  SealCheckIcon,
  LockSimpleIcon,
  ShieldCheckIcon,
  ChartLineUpIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface CommentCaMarcheModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommentCaMarcheModal({
  isOpen,
  onClose,
}: CommentCaMarcheModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent scroll when open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!mounted) return null;

  return (
    <>
      {/* ── BACKDROP ── */}
      <div
        className={cn(
          "fixed inset-0 z-100 bg-background/60 backdrop-blur-md transition-opacity duration-300",
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      />

      {/* ── SLIDE-OVER SHEET ── */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-full max-w-xl bg-background border-l border-border/40 z-110 shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-y-auto",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between p-6 md:p-10 sticky top-0 bg-background/95 backdrop-blur-sm z-20">
          <h2 className="text-xl md:text-2xl font-black text-foreground px-2">
            La preuve par les APIs
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          >
            <XIcon weight="bold" className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 md:px-12 pb-12 flex flex-col gap-12">
          <p className="text-lg md:text-xl text-muted-foreground font-medium leading-relaxed">
            Ici, pas de déclarations sur l'honneur. Les chiffres que vous voyez
            sont lus en temps réel depuis les comptes financiers des créateurs.
            Le standard absolu de transparence.
          </p>

          <div className="flex flex-col gap-10 relative">
            {/* Thread line */}
            <div className="absolute left-5 top-4 bottom-12 w-px bg-border/60" />

            {/* Step 1 */}
            <div className="flex gap-6 relative z-10">
              <div className="w-10 h-10 rounded-full bg-background border-2 border-emerald-500 font-extrabold text-foreground flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                1
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <h3 className="text-xl font-extrabold text-foreground">
                  Le maker connecte sa propre clé
                </h3>
                <p className="text-muted-foreground font-medium leading-relaxed">
                  Depuis son espace Builder Platform, le maker crée une clé API{" "}
                  <strong className="text-foreground">
                    Restreinte (Lecture Seule)
                  </strong>{" "}
                  sur son compte Stripe ou RevenueCat. Il contrôle la connexion
                  à 100%.
                </p>
                <div className="flex gap-4 mt-3">
                  <Image
                    src="/logos/stripe.svg"
                    alt="Stripe"
                    width={64}
                    height={16}
                    className="h-4 w-auto opacity-50"
                  />
                  <Image
                    src="/logos/revenuecat.svg"
                    alt="RevenueCat"
                    width={64}
                    height={16}
                    className="h-4 w-auto opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-6 relative z-10">
              <div className="w-10 h-10 rounded-full bg-muted border border-border/60 font-extrabold text-foreground flex items-center justify-center shrink-0">
                2
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <h3 className="text-xl font-extrabold text-foreground">
                  Un Job agrège les données
                </h3>
                <p className="text-muted-foreground font-medium leading-relaxed">
                  Chaque heure, notre système interroge l'API pour extraire le
                  MRR actif. Les impayés, les annulations et les essais gratuits
                  sont strictement ignorés. Seul l'argent comptant récurrent est
                  pris en compte.
                </p>
                <div className="flex items-center gap-2 mt-2 -ml-1">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-xs font-bold text-foreground">
                    <ChartLineUpIcon
                      weight="fill"
                      className="text-emerald-500 w-4 h-4"
                    />{" "}
                    MRR & ARR
                  </span>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-6 relative z-10">
              <div className="w-10 h-10 rounded-full bg-muted border border-border/60 font-extrabold text-foreground flex items-center justify-center shrink-0">
                3
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <h3 className="text-xl font-extrabold text-foreground">
                  Le monde entier voit le badge
                </h3>
                <p className="text-muted-foreground font-medium leading-relaxed">
                  La fiche produit affiche fièrement le montant certifié. Pour
                  les makers discrets, il est possible d'afficher uniquement le
                  Badge de Certification sans le montant exact.
                </p>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 text-[10px] font-black uppercase tracking-widest w-fit mt-2 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                  <SealCheckIcon weight="fill" className="w-3.5 h-3.5" />{" "}
                  Vérifié via Stripe & RevenueCat
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-8 border-t border-border/40 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-muted shrink-0 flex items-center justify-center text-foreground">
                <LockSimpleIcon weight="fill" className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-1 pt-0.5">
                <span className="text-sm font-extrabold text-foreground">
                  Strictement Read-Only
                </span>
                <span className="text-xs font-medium text-muted-foreground leading-relaxed">
                  Aucune écriture possible sur les serveurs de paiement.
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-muted shrink-0 flex items-center justify-center text-foreground">
                <ShieldCheckIcon weight="fill" className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-1 pt-0.5">
                <span className="text-sm font-extrabold text-foreground">
                  Zéro Data Client
                </span>
                <span className="text-xs font-medium text-muted-foreground leading-relaxed">
                  Nous ne lisons jamais ni les noms ni les emails des acheteurs.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
