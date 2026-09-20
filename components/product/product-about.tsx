"use client";

import { useState } from "react";
import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react";
import ReactMarkdown from "react-markdown";

const FULL_CONTENT = `
Tarsi est une application de finance personnelle **offline-first** conçue pour les utilisateurs qui veulent reprendre le contrôle de leur argent sans friction. Pensée pour la réalité malgache — des connexions internet instables aux habitudes de paiement en cash — Tarsi fonctionne partout, tout le temps.

## Ce qui rend Tarsi unique

Contrairement aux applications bancaires classiques, Tarsi ne requiert aucune connexion bancaire pour fonctionner. Vous entrez vos transactions manuellement ou vous les importez via CSV, et l'application s'occupe du reste : catégorisation intelligente, alertes de budget, et insights visuels en temps réel.

### Fonctionnalités clés

- **Suivi offline complet** — synchronisé dès que vous vous reconnectez
- **Interface Zero-UI** — pas de bruit visuel, juste vos données
- **Budgets intelligents** — alertes à 80% avant de dépasser
- **Rapports mensuels** — exportables en PDF ou CSV
- **Multi-devises** — support natif de l'ariary (MGA) et du dollar
- **Sécurité locale** — vos données ne quittent jamais votre appareil sans votre accord

## Stack technique

Construit avec **Next.js**, **React Native** et **Supabase** pour une expérience native cross-plateforme. Le moteur de synchronisation est basé sur CRDTs pour garantir la cohérence des données sans conflits.

> "Je voulais une app à la fois belle et honnête avec les données. Tarsi, c'est ma réponse à tout ce que les apps de finance font mal." — *Bryl Lim, créateur*

## Roadmap publique

La V2 est en cours de développement avec le support des comptes Mobile Money (MVola, Orange Money) et un mode famille pour les dépenses partagées.
`;

const PREVIEW_WORDS = 80;

export function ProductAbout() {
  const [expanded, setExpanded] = useState(false);

  const words = FULL_CONTENT.trim().split(/\s+/);
  const previewContent = words.slice(0, PREVIEW_WORDS).join(" ") + "…";
  const shown = expanded ? FULL_CONTENT : previewContent;

  return (
    <div className="flex flex-col gap-5 pt-6 border-t border-border/40">
      <h2 className="text-2xl font-extrabold tracking-tight text-foreground">À propos de Tarsi</h2>

      <div
        className="prose prose-zinc dark:prose-invert prose-p:text-muted-foreground prose-p:font-medium prose-p:leading-relaxed prose-headings:font-extrabold prose-headings:tracking-tight prose-li:font-medium prose-li:text-muted-foreground prose-blockquote:border-l-border prose-blockquote:text-muted-foreground prose-strong:text-foreground max-w-none text-[15px] md:text-[16px] transition-all"
      >
        <ReactMarkdown>{shown}</ReactMarkdown>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="self-start flex items-center gap-1.5 text-[12px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mt-1"
      >
        {expanded ? (
          <><CaretUpIcon weight="bold" className="w-3.5 h-3.5" /> Voir moins</>
        ) : (
          <><CaretDownIcon weight="bold" className="w-3.5 h-3.5" /> Voir plus</>
        )}
      </button>
    </div>
  );
}
