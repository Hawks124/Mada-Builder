"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  XIcon,
  SealCheckIcon,
  LockSimpleIcon,
  ShieldCheckIcon,
  ChartLineUpIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * « Comment fonctionne la vérification ? » — panneau latéral (slide-over) qui
 * explique la mécanique des revenus vérifiés.
 *
 * **Le nom du composant mentait.** Il s'appelait `CommentCaMarcheModal` alors
 * que son contenu ne parle que de revenus vérifiés, et son titre — « La preuve
 * par les APIs » — ne correspondait ni au bouton qui l'ouvre, ni au reste du
 * produit. C'est la source du problème que ce panneau prétend résoudre :
 * expliquer comment on prouve. Il est donc renommé, et son titre énonce
 * exactement ce qu'il explique.
 *
 * **Accessibilité.** C'était un `div` qui glisse : sans `role="dialog"`, ni
 * `aria-modal`, ni libellé, ni touche Échap, ni gestion du focus, il était
 * invisible pour un lecteur d'écran et piégeait le clavier — impossible à
 * fermer au clavier, et le focus partait derrière le voile. Corrigé ici :
 * sémantique de dialogue, Échap, focus à l'ouverture, focus rendu à l'élément
 * d'origine à la fermeture, et le panneau masqué (`inert`) tant qu'il est
 * fermé pour qu'il ne reste pas dans le parcours de tabulation.
 *
 * **Reste à faire plus tard** : piégeage complet du focus dans une boucle.
 * today le focus est posé à l'ouverture et rendu à la fermeture, ce qui couvre
 * le cas réel ; une boucle complète est le seul écart restant.
 */
export function RevenueVerificationSheet({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Verrou du défilement + Échap + focus. Le `overflow` est remis à la chaîne
  // vide et non à `"unset"` : `unset` est la valeur initiale du CSS, pas une
  // valeur de `overflow`, et le remettre réinitialise la propriété de façon
  // imprévisible selon les navigateurs.
  useEffect(() => {
    if (!isOpen) return;

    openerRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      // Le focus revient à ce qui a ouvert le panneau : sans ça, il tombe sur
      // `body` et l'utilisateur repart du début de la page.
      openerRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!mounted) return null;

  return (
    <>
      {/* ── Voile ── */}
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-100 bg-background/60 backdrop-blur-md transition-opacity duration-300",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* ── Panneau ── */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={isOpen ? true : undefined}
        aria-labelledby="verification-sheet-title"
        tabIndex={-1}
        inert={!isOpen}
        className={cn(
          "fixed right-0 top-0 z-110 h-full w-full max-w-xl overflow-y-auto border-l border-border/40 bg-background shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* ── En-tête collant ── */}
        <div className="sticky top-0 z-20 flex items-start justify-between gap-6 border-b border-border/40 bg-background/95 px-6 py-6 backdrop-blur-sm md:px-10">
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
              Revenus vérifiés
            </p>
            <h2
              id="verification-sheet-title"
              className="text-2xl font-black tracking-tight text-foreground text-balance md:text-[1.75rem]"
            >
              Comment fonctionne la vérification ?
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          >
            <XIcon weight="bold" className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-10 px-6 py-8 md:px-10 md:py-10">
          <p className="max-w-[52ch] text-lg font-medium leading-relaxed text-muted-foreground text-pretty">
            Aucun maker ne déclare son chiffre. Nous lisons un agrégat chez son prestataire de
            facturation, en lecture seule. Vous pouvez donc vérifier la méthode plutôt que croire
            une promesse.
          </p>

          {/* ── Les trois étapes ── */}
          <ol className="flex flex-col gap-4">
            <Step
              index={1}
              title="Le maker connecte sa propre clé"
              highlight="Restreinte, en lecture seule"
            >
              <p>
                Depuis son tableau de bord, le maker crée une clé{" "}
                <strong className="font-black text-foreground">
                  restreinte à la lecture seule
                </strong>{" "}
                chez Stripe ou RevenueCat. Il garde la main sur la connexion : c&apos;est lui qui la
                pose, et lui qui peut la révoquer.
              </p>
              <div className="mt-3.5 flex items-center gap-4 opacity-55">
                <ProviderLogo src="/logos/stripe.svg" alt="Stripe" />
                <ProviderLogo src="/logos/revenuecat.svg" alt="RevenueCat" />
              </div>
            </Step>

            <Step
              index={2}
              title="Un job agrège, chaque heure"
              highlight="Essais et impayés exclus"
            >
              <p>
                Toutes les heures, notre job interroge l&apos;API et extrait le revenu récurrent
                actif. Les essais, les résiliations et les paiements en défaut sont exclus : seul
                l&apos;argent récurrent encaissé compte.
              </p>
              <span className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-foreground">
                <ChartLineUpIcon weight="fill" className="h-4 w-4 text-emerald-500" />
                MRR et ARR
              </span>
            </Step>

            <Step
              index={3}
              title="Le montant apparaît sur la fiche"
              highlight="Badge seul, si vous préférez"
            >
              <p>
                La fiche affiche le montant certifié. Un maker qui préfère rester discret peut
                n&apos;afficher que le badge, sans le chiffre — son choix, à tout moment.
              </p>
              <span className="mt-3.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                <SealCheckIcon weight="fill" className="h-3.5 w-3.5" />
                Vérifié par lecture directe
              </span>
            </Step>
          </ol>

          {/* ── Garanties ── */}
          <div className="grid grid-cols-1 gap-4 border-t border-border/40 pt-8 md:grid-cols-2">
            <Guarantee
              icon={LockSimpleIcon}
              title="Lecture seule, sans exception"
              body="La clé ne peut rien déclencher : ni charge, ni remboursement, ni transfert."
            />
            <Guarantee
              icon={ShieldCheckIcon}
              title="Aucune donnée client"
              body="Nous ne lisons jamais les noms ni les adresses de vos acheteurs."
            />
          </div>
        </div>
      </div>
    </>
  );
}

function Step({
  index,
  title,
  highlight,
  children,
}: {
  index: number;
  title: string;
  /** Le point qui fait la différence de cette étape, isolé du paragraphe. */
  highlight: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4 rounded-2xl border border-border/50 bg-muted/30 p-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background text-[13px] font-black tabular-nums text-foreground">
        {index}
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <h3 className="text-[17px] font-extrabold tracking-tight text-foreground">{title}</h3>
        {/* `div` et non `p` : les appelants passent un paragraphe **et** un
            bloc de logos. Un `<p>` ne peut contenir ni `<p>` ni `<div>` — le
            parseur HTML ferme alors le paragraphe externe et produit un DOM
            différent de celui que React attend, d'où l'erreur d'hydratation.
            La typographie est héritée (taille, graisse, interligne, couleur),
            donc le rendu est identique à un `<p>` wrapper. */}
        <div className="text-[15px] font-medium leading-relaxed text-muted-foreground">
          {children}
        </div>
        <span className="text-[13px] font-bold text-foreground/80">{highlight}</span>
      </div>
    </li>
  );
}

function Guarantee({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string; weight?: "fill" }>;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
        <Icon weight="fill" className="h-4.5 w-4.5" />
      </span>
      <div className="flex flex-col gap-1">
        <span className="text-[14px] font-extrabold text-foreground">{title}</span>
        <span className="text-[13px] font-medium leading-relaxed text-muted-foreground">
          {body}
        </span>
      </div>
    </div>
  );
}

function ProviderLogo({ src, alt }: { src: string; alt: string }) {
  return <Image src={src} alt={alt} width={72} height={18} className="h-[18px] w-auto" />;
}
