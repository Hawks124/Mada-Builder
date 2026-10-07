"use client";

import { PRODUCT_LINK_FIELDS, hasAccessPoint, requiredFor } from "@/config/product-links";
import { isMonetizedPricing } from "@/config/pricing";
import type { UrlPolicy } from "@/lib/url-verdict";

const DEV_FACING_TYPES = ["cli", "package", "framework", "plugin"];

export type SubmitValidationInput = {
  /** "publish" ou "draft" (bouton cliqué). */
  intent: "publish" | "draft";
  /** Textes lus du FormData (déjà trimmés côté appelant si besoin). */
  fields: Record<string, string>;
  productType: string;
  audience: string;
  pricing: string;
  /** Catégories sélectionnées (JSON parsé). */
  categories: string[];
  /** Tags libres (JSON parsé). */
  tags: string[];
  /** Plateformes sélectionnées (JSON parsé). */
  platforms: string[];
  /** Pays cibles (JSON parsé). */
  targetCountries: string[];
  /** Langues (JSON parsé). */
  languages: string[];
  linkValues: Record<string, string>;
  linkPolicies: Record<string, UrlPolicy>;
  /** Création publish : logo + captures obligatoires. */
  media: { hasLogo: boolean; shotCount: number };
  isEditing: boolean;
  /** Édition d'un brouillon : publish = mêmes exigences médias que création. */
  editingDraft: boolean;
};

/**
 * Validation inline (miroir FIDÈLE du serveur, jamais l'inverse) :
 * - Zod de base + orientation + installCommand : TOUJOURS (draft inclus) ;
 * - médias + matrice liens + privacy + reachability : PUBLISH seulement
 *   (le draft est un travail en cours — même règle que le serveur).
 * Retourne les erreurs par clé `name` d'input (ex. "tagline", "website").
 */
export function validateSubmitClient(input: SubmitValidationInput): Record<string, string> {
  const errors: Record<string, string> = {};
  const set = (key: string, message: string) => {
    if (!(key in errors)) errors[key] = message;
  };
  const len = (key: string): string => (input.fields[key] ?? "").trim();

  const name = len("name");
  if (name.length < 2) set("name", "Nom : requis (min 2 caractères).");
  else if (name.length > 80) set("name", "Nom : trop long (max 80 caractères).");

  const tagline = len("tagline");
  if (tagline.length < 1) set("tagline", "Tagline : requise.");
  else if (tagline.length > 220) set("tagline", "Tagline : trop longue (max 220 caractères).");

  const description = len("description");
  if (description.length < 20) set("description", "Description : trop courte (min 20 caractères).");
  else if (description.length > 20000)
    set("description", "Description : trop longue (max 20000 caractères).");

  const license = len("license");
  if (license.length > 60) set("license", "Licence : trop longue (max 60 caractères).");

  const installCommand = len("installCommand");
  if (installCommand.length > 200)
    set("installCommand", "Commande d'installation : trop longue (max 200 caractères).");
  if (DEV_FACING_TYPES.includes(input.productType) && installCommand === "") {
    set("installCommand", "Commande d'installation : requise pour ce type de produit.");
  }

  const version = len("version");
  if (version.length > 20) set("version", "Version : trop longue (max 20 caractères).");

  const requirements = len("requirements");
  if (requirements.length > 500)
    set("requirements", "Configuration requise : trop longue (max 500 caractères).");

  const changelog = len("changelogUrl");
  if (changelog !== "") {
    try {
      const u = new URL(changelog);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        set("changelogUrl", "Journal des modifications : URL invalide (http(s) uniquement).");
      }
    } catch {
      set("changelogUrl", "Journal des modifications : URL invalide.");
    }
  }

  if (input.categories.length === 0) set("categories", "Catégorie : au moins une requise.");
  if (input.platforms.length === 0) set("platforms", "Plateformes : au moins une requise.");
  if (input.tags.some((t) => t.length > 30) || input.tags.length > 5) {
    set("tags", "Tags : max 5, 30 caractères chacun.");
  }
  if (input.targetCountries.some((c) => c.length > 60) || input.targetCountries.length > 10) {
    set("targetCountries", "Pays cibles : max 10, 60 caractères chacun.");
  }
  if (input.languages.some((l) => l.length > 30) || input.languages.length > 20) {
    set("languages", "Langues : max 20, 30 caractères chacune.");
  }

  if (input.intent === "draft") return errors;

  // ── Publish uniquement (miroir assertLinkRules + reachability) ──
  // Médias : création toujours ; édition seulement si le brouillon
  // passe en revue (miroir `publishing` serveur — une fiche en ligne
  // ou en revue a déjà ses médias validés).
  if (!input.isEditing || input.editingDraft) {
    if (!input.media.hasLogo) set("logo", "Logo requis pour publier (brouillon accepté sans).");
    if (input.media.shotCount === 0)
      set("screenshots", "Au moins une capture requise pour publier.");
  }
  if (!hasAccessPoint(input.linkValues)) {
    set("website", "Au moins un point d'accès requis : site, store, registre ou démo.");
  }
  const monetized = isMonetizedPricing(input.pricing);
  for (const field of Object.values(PRODUCT_LINK_FIELDS)) {
    const eff = requiredFor(field, input.productType);
    const needed =
      (eff === "kids" && input.audience === "kids") || (eff === "monetized" && monetized);
    if (needed && (input.linkValues[field.id] ?? "").trim() === "") {
      const why = eff === "kids" ? "audience enfants" : "produit monétisé";
      set(field.id, `${field.label} : requis (${why}).`);
    }
    const policy = input.linkPolicies[field.id];
    if (policy === "block" && (input.linkValues[field.id] ?? "").trim() !== "") {
      set(field.id, `${field.label} : lien injoignable — corrigez avant de publier.`);
    }
  }
  if (monetized && (input.linkValues.privacy ?? "").trim() === "") {
    set("privacy", "Politique de confidentialité : requise (produit monétisé).");
  }
  return errors;
}

/** Ordre des champs pour le focus (premier fautif = premier du formulaire). */
const FIELD_ORDER = [
  "name",
  "tagline",
  "description",
  "categories",
  "platforms",
  "website",
  "privacy",
  "installCommand",
  "version",
  "requirements",
  "changelogUrl",
  "license",
  "logo",
  "screenshots",
  "targetCountries",
  "languages",
];

/**
 * Focus + scroll sur le premier champ fautif (`name`, sinon ancre).
 * Robuste : `block: "center"` (jamais caché sous la navbar sticky),
 * `preventScroll` au focus (pas de double scroll), mouvement réduit
 * respecté. Les ancres portent `scroll-mt` en renfort.
 */
export function focusFirstError(errors: Record<string, string>): void {
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const keys = Object.keys(errors).sort((a, b) => FIELD_ORDER.indexOf(a) - FIELD_ORDER.indexOf(b));
  for (const key of keys) {
    const el =
      document.querySelector<HTMLElement>(`[name="${key}"]`) ??
      document.querySelector<HTMLElement>(`[data-field-anchor="${key}"]`);
    if (el) {
      el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      el.focus({ preventScroll: true });
      return;
    }
  }
}
