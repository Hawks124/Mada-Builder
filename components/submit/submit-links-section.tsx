"use client";

import {
  BASE_LINK_FIELDS,
  PRODUCT_LINKS_BY_TYPE,
  PRODUCT_LINK_FIELDS,
  hasAccessPoint,
  requiredFor,
} from "@/config/product-links";
import { isMonetizedPricing } from "@/config/pricing";
import { useSubmitForm } from "@/components/submit/submit-form-context";
import { UrlField } from "@/components/submit/url-field";
import { FieldBadge } from "@/components/ui/field-badge";

/**
 * Liens & Plateformes — DYNAMIQUE par type de produit : socle + bloc du
 * type (3-5 champs max, le reste n'existe pas à l'écran — invisible = pas
 * de friction). Règles : "au moins un point d'accès" (jamais un champ
 * précis), privacy requise si kids OU monétisé, badges recommandés
 * (almost). Chaque champ porte sa pastille de vérification à la volée.
 */
export function SubmitLinksSection() {
  const { productType, audience, pricing, linkValues } = useSubmitForm();
  const isKids = audience === "kids";
  const monetized = isMonetizedPricing(pricing);

  const specific = PRODUCT_LINKS_BY_TYPE[productType] ?? PRODUCT_LINKS_BY_TYPE.other ?? [];
  const visible = [...BASE_LINK_FIELDS, ...specific]
    .map((id) => PRODUCT_LINK_FIELDS[id])
    .filter((f): f is NonNullable<typeof f> => Boolean(f));

  const badgeFor = (id: string): "required" | "recommended" | "optional" => {
    const field = PRODUCT_LINK_FIELDS[id];
    if (!field) return "optional";
    const eff = requiredFor(field, productType);
    if (eff === "kids") return isKids ? "required" : "optional";
    if (eff === "monetized") return monetized ? "required" : "optional";
    if (eff === "almost") return "recommended";
    return "optional";
  };

  const hasAccess = hasAccessPoint(linkValues);

  // Miroirs des valeurs hors-champ (changement de type) : sans eux, les
  // liens du type précédent seraient silencieusement supprimés au submit
  // (inputs démontés = absents du FormData = effacés côté serveur).
  const visibleIds = new Set(visible.map((f) => f.id));
  const hiddenEntries = Object.entries(linkValues).filter(([id]) => !visibleIds.has(id));

  return (
    <div className="flex flex-col gap-10">
      {hiddenEntries.map(([id, value]) => (
        <input key={`hidden:${id}`} type="hidden" name={id} value={value} />
      ))}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight">Liens & Plateformes</h2>
        <p className="text-[14px] font-medium text-muted-foreground">
          Où les utilisateurs peuvent-ils trouver et télécharger votre produit ?{" "}
          <span className="text-foreground font-bold">
            Au moins un point d&apos;accès est requis
          </span>{" "}
          — site, store, registre ou démo, au choix.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        {visible.map((field) => (
          <UrlField key={`${productType}:${field.id}`} field={field} badge={badgeFor(field.id)} />
        ))}
      </div>

      {!hasAccess && (
        <p className="text-[13px] text-center font-bold text-amber-600 dark:text-amber-400">
          Ajoutez au moins un point d&apos;accès (site, store, registre ou démo) pour soumettre.
        </p>
      )}

      <div className="w-full h-px bg-border/40 my-2" />

      {/* Légal et Confiance */}
      <div className="flex flex-col gap-6">
        <h3 className="text-sm font-black tracking-widest uppercase text-muted-foreground">
          Légal et Confiance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <UrlField
            key="legal:privacy"
            field={PRODUCT_LINK_FIELDS.privacy!}
            badge={isKids || monetized ? "required" : "optional"}
          />
          <UrlField key="legal:tos" field={PRODUCT_LINK_FIELDS.tos!} badge="optional" />
          {isKids && (
            <UrlField
              key="legal:kidsafety"
              field={PRODUCT_LINK_FIELDS.kidsafety!}
              badge="required"
            />
          )}
        </div>
        {isKids ? (
          <p className="text-[12px] font-medium text-muted-foreground">
            Audience enfants : confidentialité et sécurité enfants requises (conformité stores).
            <FieldBadge variant="required" />
          </p>
        ) : (
          monetized && (
            <p className="text-[12px] font-medium text-muted-foreground">
              Produit monétisé : les stores exigent une politique de confidentialité.
            </p>
          )
        )}
      </div>
    </div>
  );
}
