"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import QRCode from "react-qr-code";
import {
  CheckIcon,
  CopyIcon,
  ShareNetworkIcon,
  XIcon,
  XLogoIcon,
  WhatsappLogoIcon,
  LinkedinLogoIcon,
  EnvelopeSimpleIcon,
  CaretUpIcon,
  SealCheckIcon,
} from "@phosphor-icons/react";
import { AvatarImage } from "@/components/ui/avatar-image";
import { cn } from "@/lib/utils";
import { useVoteWall } from "@/components/votes/use-vote-wall";

/**
 * Dialogue de partage fiche produit — portail document.body + z élevé :
 * insensible aux ancêtres transformés et à la navbar (conflit constaté
 * en QA). Layout max-w-md : rangée produit (avatar, nom, "par", seal
 * bleu), rangée QR + bloc vote, caption scanner, champ URL + copier,
 * 4 sociaux (liens d'intention purs, zéro dépendance), partage système.
 * QR généré EN LOCAL (aucun appel réseau). URL = canonique de la page.
 * Prototype : maker + votes mockés par l'appelant (TODO Server Action).
 */
export function ShareDialog({
  open,
  onClose,
  productName,
  productLogo,
  makerName,
  makerVerified,
  voteCount,
}: {
  open: boolean;
  onClose: () => void;
  productName: string;
  /** Logo produit (image ou tuile initiales) — c'est LUI qu'on partage. */
  productLogo: { src?: string | null; initials: string; gradient?: string };
  makerName: string;
  makerVerified: boolean;
  voteCount: number;
}) {
  const [copied, setCopied] = React.useState(false);
  const [voted, setVoted] = React.useState(false);
  const guardedVote = useVoteWall();
  // URL canonique calculée au rendu (pas d'effect) : `window` absent côté
  // serveur → chaîne vide, corrigée à l'hydratation (warning supprimé —
  // le QR n'existe que côté client de toute façon).
  const url = typeof window === "undefined" ? "" : window.location.href;
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  // Reset "copié" à chaque ouverture — setState pendant le rendu (pattern
  // React autorisé pour l'état dérivé, jamais dans un effect).
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    setCopied(false);
  }

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "unset";
    };
  }, [open, onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: productName, url });
    } catch {
      // Annulé par l'utilisateur : on reste dans le dialogue.
    }
  };

  if (!open) return null;

  const encoded = encodeURIComponent(url);
  const text = encodeURIComponent(`${productName} — via Mada-Made`);
  const socials = [
    {
      label: "Partager sur X",
      href: `https://twitter.com/intent/tweet?url=${encoded}&text=${text}`,
      Icon: XLogoIcon,
    },
    {
      label: "Partager sur WhatsApp",
      href: `https://wa.me/?text=${text}%20${encoded}`,
      Icon: WhatsappLogoIcon,
    },
    {
      label: "Partager sur LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`,
      Icon: LinkedinLogoIcon,
    },
    {
      label: "Partager par email",
      href: `mailto:?subject=${text}&body=${encoded}`,
      Icon: EnvelopeSimpleIcon,
    },
  ];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Partager ${productName}`}
      onClick={onClose}
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-3xl border border-border/60 bg-background p-6 flex flex-col gap-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
            Partager ce produit
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <XIcon weight="bold" className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-muted/20 px-4 py-3">
          {productLogo.src ? (
            <AvatarImage src={productLogo.src} name={productName} size={48} />
          ) : (
            <span
              aria-hidden="true"
              className={cn(
                "w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center text-white font-black text-lg bg-linear-to-br shadow-sm",
                productLogo.gradient ?? "from-zinc-500 to-zinc-700",
              )}
            >
              {productLogo.initials}
            </span>
          )}
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[16px] font-extrabold tracking-tight text-foreground truncate">
              {productName}
            </span>
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
              par {makerName}
              {makerVerified && (
                <SealCheckIcon
                  weight="fill"
                  className="w-4 h-4 text-blue-500"
                  aria-label="Vérifié"
                />
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void guardedVote(() => setVoted((v) => !v))}
            aria-label={voted ? "Retirer mon vote" : "Voter pour ce produit"}
            aria-pressed={voted}
            className="flex flex-col items-center gap-0.5 shrink-0 cursor-pointer group/vote"
          >
            <CaretUpIcon
              weight="fill"
              className={
                voted
                  ? "w-6 h-6 text-emerald-500 transition-colors"
                  : "w-6 h-6 text-muted-foreground group-hover/vote:text-foreground transition-colors"
              }
            />
            <span className="text-[15px] font-black tabular-nums text-foreground">
              {voteCount + (voted ? 1 : 0)}
            </span>
            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">
              Voter
            </span>
          </button>
        </div>

        <div className="flex items-center gap-5">
          {url !== "" && (
            <div
              suppressHydrationWarning
              className="flex items-center justify-center rounded-2xl bg-white p-3 shrink-0"
            >
              <QRCode value={url} size={132} bgColor="#ffffff" fgColor="#09090b" />
            </div>
          )}
          <p className="text-[13px] font-medium text-muted-foreground leading-relaxed">
            Scanner pour ouvrir sur mobile — le QR encode l&apos;adresse exacte de cette fiche, sans
            tracking ajouté.
          </p>
        </div>

        <div className="flex items-center gap-2 pl-4 pr-2 py-2">
          <span className="flex-1 min-w-0 truncate font-mono text-[12px] text-muted-foreground">
            {url}
          </span>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 h-9 px-4  text-muted-foreground text-[13px] font-bold hover:opacity-90 transition-opacity cursor-pointer shrink-0"
          >
            {copied ? (
              <CheckIcon weight="bold" className="w-4 h-4" />
            ) : (
              <CopyIcon className="w-4 h-4" />
            )}
            {copied ? "Copié !" : "Copier"}
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {socials.map(({ label, href, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              title={label}
              className="flex items-center justify-center h-11 rounded-full border border-border/40 text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-muted/50 transition-colors"
            >
              <Icon weight="regular" className="w-5 h-5" />
            </a>
          ))}
        </div>

        {canNativeShare && (
          <button
            type="button"
            onClick={nativeShare}
            className="inline-flex items-center justify-center gap-2 h-12 rounded-full border border-border/40 text-[14px] font-bold text-background hover:text-foreground hover:border-foreground/30 bg-foreground hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <ShareNetworkIcon weight="bold" className="w-4 h-4" />
            Options de partage système…
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
