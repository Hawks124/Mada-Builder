"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowSquareOutIcon,
  CheckIcon,
  CopyIcon,
  DownloadSimpleIcon,
  PlayIcon,
  ShareNetworkIcon,
} from "@phosphor-icons/react";
import { ActionButton } from "@/components/ui/action-button";
import { StoreLogo } from "@/components/ui/store-logo";
import {
  BASE_LINK_FIELDS,
  PRODUCT_LINKS_BY_TYPE,
  PRODUCT_LINK_FIELDS,
  registryDisplayName,
} from "@/config/product-links";

/**
 * Blocs liens par type de produit (fiche) — piloté par
 * `config/product-links` (même matrice que le submit) : CTA primaire
 * ("Visiter le site" pour le web, label du champ sinon), boutons stores,
 * bouton registre dynamique ("Voir sur NPM/PyPI/…"), carte téléchargement,
 * commande d'install copiable, banner vidéo 16:9 standalone.
 * Props = forme des données submit (le milestone listings branchera la DB
 * sans toucher ce composant). Langage visuel d'origine conservé (pill
 * sombre, pills stores, bloc install).
 */
export function ProductLinks({
  productType,
  links,
  installCommand,
  share = false,
  onShare,
  unverifiedCount = 0,
}: {
  productType: string;
  /** field-id (matrice) → URL. */
  links: Record<string, string | undefined>;
  installCommand?: string | null;
  share?: boolean;
  onShare?: () => void;
  unverifiedCount?: number;
}) {
  const [copied, setCopied] = React.useState(false);

  const specific = PRODUCT_LINKS_BY_TYPE[productType] ?? PRODUCT_LINKS_BY_TYPE.other ?? [];
  const access = [...BASE_LINK_FIELDS, ...specific]
    .map((id) => PRODUCT_LINK_FIELDS[id])
    .filter((f): f is NonNullable<typeof f> => Boolean(f))
    .filter((f) => f.accessPoint && (links[f.id] ?? "").trim() !== "")
    .filter((f) => f.id !== "download" && f.id !== "video");

  const registry = access.find((f) => f.id === "registry");
  const rest = access.filter((f) => f.id !== "registry");
  const [primary, ...others] = rest;
  const downloadUrl = (links.download ?? "").trim() || null;

  const copyInstall = async () => {
    if (!installCommand) return;
    try {
      await navigator.clipboard.writeText(installCommand);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!primary && !installCommand && !downloadUrl) return null;

  return (
    <div className="flex flex-col gap-2">
      {primary && (
        <ActionButton
          href={links[primary.id]!}
          variant="primary"
          className="w-full justify-center h-12 text-[15px] font-bold hover:opacity-90 transition-all active:scale-95"
        >
          <StoreLogo icon={primary.icon} className="w-4 h-4 shrink-0" />
          {primary.ctaLabel ?? primary.label}
          <ArrowSquareOutIcon weight="bold" className="w-4 h-4 ml-1 shrink-0" />
        </ActionButton>
      )}

      {(others.length > 0 || share) && (
        <div className="flex flex-col gap-2">
          {others.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {others.slice(0, 4).map((field) => (
                <Link
                  key={field.id}
                  href={links[field.id]!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-full border border-border/50 bg-muted/20 hover:bg-foreground hover:text-background hover:border-foreground transition-all duration-200 text-[12px] font-bold group whitespace-nowrap"
                >
                  <StoreLogo icon={field.icon} className="w-4 h-4 shrink-0" />
                  {field.label}
                </Link>
              ))}
            </div>
          )}
          {share && (
            <button
              type="button"
              onClick={onShare}
              className="flex items-center justify-center gap-2 py-2 rounded-full border border-transparent text-[12px] font-bold text-muted-foreground hover:text-foreground hover:border-border/50 hover:bg-muted/30 transition-all cursor-pointer"
            >
              <ShareNetworkIcon weight="bold" className="w-4 h-4 shrink-0" />
              Partager ce produit
            </button>
          )}
        </div>
      )}

      {registry && (
        <Link
          href={links.registry!}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 py-2 rounded-full bg-orange-500/10 text-orange-600 hover:text-white dark:text-orange-400 text-[12px] font-bold hover:bg-orange-500 transition-colors"
        >
          <StoreLogo icon={registry.icon} className="w-4 h-4 shrink-0" />
          Voir sur {registryDisplayName(links.registry!)}
        </Link>
      )}

      {installCommand && (
        <div className="flex flex-col gap-3 p-4 bg-muted/10">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Installation
          </span>
          <div className="flex items-center justify-between px-3.5 py-3 bg-background rounded-[5px] border border-border/50 font-mono text-[13px] text-foreground">
            <span className="truncate">{installCommand}</span>
            <button
              type="button"
              onClick={copyInstall}
              aria-label="Copier la commande"
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted cursor-pointer shrink-0"
            >
              {copied ? (
                <CheckIcon weight="bold" className="w-4 h-4 text-emerald-500" />
              ) : (
                <CopyIcon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {downloadUrl && (
        <div className="flex flex-col gap-3 p-5 rounded-2xl border border-border/40 bg-muted/10">
          <div className="flex items-center gap-2 text-muted-foreground">
            <DownloadSimpleIcon weight="bold" className="w-4 h-4 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Téléchargement direct
            </span>
          </div>
          <p className="text-[12px] font-medium text-muted-foreground truncate font-mono">
            {fileNameOf(downloadUrl)}
          </p>
          <Link
            href={downloadUrl}
            className="flex items-center justify-center gap-2 h-11 rounded-full bg-foreground text-background text-[14px] font-bold hover:opacity-90 transition-all active:scale-[0.98]"
          >
            <DownloadSimpleIcon weight="bold" className="w-4 h-4 shrink-0" />
            Télécharger
          </Link>
        </div>
      )}

      {unverifiedCount > 0 && (
        <p className="text-[12px] font-medium text-amber-600 dark:text-amber-400">
          {unverifiedCount} lien{unverifiedCount > 1 ? "s" : ""} non vérifié
          {unverifiedCount > 1 ? "s" : ""} — en cours de revue.
        </p>
      )}
    </div>
  );
}

/** Nom de fichier depuis une URL (carte download) — repli : hôte. */
function fileNameOf(url: string): string {
  try {
    const path = new URL(url).pathname.split("/").filter(Boolean).pop();
    if (path && path.includes(".")) return decodeURIComponent(path);
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Mock Tarsi (fiche prototype) — TOUT le type mobile rempli : même forme
 * que le submit, consommé par la sidebar (liens) ET la page (vidéo).
 * Le milestone listings branchera la DB ici sans toucher les composants.
 */
export const MOCK_TARSI_LINKS: Record<string, string> = {
  website: "https://example.com",
  appstore: "https://apps.apple.com",
  playstore: "https://play.google.com",
  source: "https://github.com",
  demo: "https://demo.example.com",
  docs: "https://docs.example.com",
};

export const MOCK_TARSI_VIDEO = "https://youtu.be/1NgO4Tzv27I?si=aLi4qXbsqfaVXPNV";

/**
 * Banner vidéo STANDALONE — colonne principale uniquement (jamais
 * sidebar : trop étroit ; jamais galerie : ratio). Preview YouTube quand
 * détecté (`i.ytimg.com`, dérivé en pur client sans clé — le clic sort
 * vers YouTube de toute façon, coût vie-privée marginal nul), fond
 * dégradé sinon (repli honnête, pas de fausse miniature). Cercle play
 * 64 px, survol scale + anneau, titre + domaine. Lien sortant (pas
 * d'embed : pas de tracking tiers, pas de poids). Rien si pas d'URL.
 */
export function youtubeVideoId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?[^#]*v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/,
  );
  return m?.[1] ?? null;
}

export function ProductVideoBanner({ videoUrl }: { videoUrl: string }) {
  const url = (videoUrl ?? "").trim();
  if (url === "") return null;
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    host = url;
  }
  const ytId = youtubeVideoId(url);
  const preview = ytId !== null ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : null;
  return (
    <Link
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block w-full aspect-video rounded-3xl overflow-hidden bg-zinc-950 dark:bg-black border border-border/40 hover:border-border/80 transition-colors"
    >
      {preview !== null ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.14),transparent_65%)]"
        />
      )}
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex items-center justify-center w-[72px] h-[72px] rounded-full bg-white text-black shadow-2xl ring-4 ring-white/25 motion-safe:group-hover:scale-105 transition-transform">
          <PlayIcon weight="fill" className="w-7 h-7 ml-1" />
        </span>
      </span>
      <span className="absolute left-5 bottom-4 right-5 flex flex-col min-w-0">
        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white/60">
          Bande-annonce
        </span>
        <span className="text-[17px] font-extrabold tracking-tight text-white leading-snug">
          Voir la démo en vidéo
        </span>
        <span className="text-[12px] font-medium text-white/60 truncate">{host}</span>
      </span>
    </Link>
  );
}
