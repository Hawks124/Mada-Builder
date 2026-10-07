"use client";

import { useState, useRef } from "react";
import { Link, ListBullets, Code } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import { InputField } from "@/components/ui/input-field";
import { Prose } from "@/components/ui/prose";
import { ReadmeImporter } from "@/components/submit/readme-importer";
import { FieldBadge } from "@/components/ui/field-badge";
import { AgeBadge } from "@/components/ui/age-badge";
import { AGE_RATINGS } from "@/config/ratings";
import { LIFECYCLE_STATUS } from "@/config/lifecycle";
import { PRODUCT_TYPES } from "@/config/product-types";
import { useSubmitForm } from "@/components/submit/submit-form-context";

const OPTION_ICON_CLASS = "w-4 h-4 shrink-0";

const PRODUCT_TYPE_OPTIONS = PRODUCT_TYPES.map((t) => ({
  id: t.id,
  label: t.label,
  icon: <t.icon weight="fill" className={OPTION_ICON_CLASS} />,
}));

// Source unique : config/ratings.tsx (backend-ready). Le mini AgeBadge
// sert d'icône d'option — cohérent avec les badges affichés sur le site.
const AUDIENCE_RATINGS = AGE_RATINGS.map((r) => ({
  id: r.id,
  label: r.label,
  icon: <AgeBadge value={r.badge} size="xs" />,
}));

export function SubmitBasicsSection() {
  const {
    productType,
    setProductType,
    audience,
    setAudience,
    lifecycle,
    setLifecycle,
    editApp,
    errors,
    clearError,
    draft,
  } = useSubmitForm();
  const [desc, setDesc] = useState(draft?.description ?? editApp?.description ?? "");
  const [preview, setPreview] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const descError = errors["description"];

  const insertMarkdown = (prefix: string, suffix: string = "") => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = desc;
    const before = text.substring(0, start);
    const selected = text.substring(start, end);
    const after = text.substring(end);
    // Trim la sélection : `**dolor **` (espace traînante) ne parse pas
    // en gras (spec CommonMark) — les espaces restent hors balises.
    const leading = selected.match(/^\s*/)?.[0] ?? "";
    const trailing = selected.match(/\s*$/)?.[0] ?? "";
    const core = selected.slice(leading.length, selected.length - trailing.length);

    setDesc(before + leading + prefix + core + suffix + trailing + after);

    // Reset focus and cursor position after react state update
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        // Sans sélection : curseur entre les balises (frappe directe).
        const pos =
          core === ""
            ? start + leading.length + prefix.length
            : start + leading.length + prefix.length + core.length + suffix.length;
        textareaRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight">Généralités</h2>
        <p className="text-[14px] font-medium text-muted-foreground">
          Les informations essentielles que les utilisateurs verront en premier.
        </p>
      </div>

      <div className="flex flex-col gap-10">
        {/* App Name */}
        <InputField
          label="Nom du produit"
          subtitle="Le nom officiel de votre produit."
          placeholder="ex: Bantay Budget"
          defaultValue={draft?.name ?? editApp?.name ?? ""}
          isRequired={true}
          name="name"
          maxLength={80}
          showCount
          errorKey="name"
        />

        {/* Tagline */}
        <InputField
          label="Tagline"
          subtitle="Une ligne accrocheuse — jusqu'à 220 caractères."
          placeholder="Envoyez de l'argent, payez vos factures et épargnez dans une seule application."
          maxLength={220}
          defaultValue={draft?.tagline ?? editApp?.tagline ?? ""}
          isRequired={true}
          name="tagline"
          showCount
          errorKey="tagline"
        />

        {/* Product Type & Lifecycle — z décroissant : chaque menu ouvert recouvre ce qui suit */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="flex flex-col gap-2 relative z-30">
            <label className="text-[14px] font-bold text-foreground flex items-center gap-2">
              Type de produit
              <FieldBadge variant="required" />
            </label>
            <Select value={productType} onChange={setProductType} options={PRODUCT_TYPE_OPTIONS} />
          </div>
          <div className="flex flex-col gap-2 relative z-20">
            <label className="text-[14px] font-bold text-foreground flex items-center gap-2">
              Avancement
              <FieldBadge variant="required" />
            </label>
            <Select
              value={lifecycle}
              onChange={setLifecycle}
              options={LIFECYCLE_STATUS.map((s) => ({
                id: s.id,
                label: s.label,
                description: s.description,
                icon: <s.icon weight="fill" className="w-4 h-4 shrink-0" />,
              }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 items-start">
          <div className="flex flex-col gap-2 relative z-10">
            <label className="text-[14px] font-bold text-foreground flex items-center gap-2">
              Audience & âge
              <FieldBadge variant="required" />
            </label>
            <Select value={audience} onChange={setAudience} options={AUDIENCE_RATINGS} />
            {/* Pas d'input kids ici : les liens privacy/kidsafety vivent dans
                la section Liens (Légal et Confiance), seule source envoyée. */}
          </div>
        </div>

        {/* Custom Zero-UI Functional Markdown Editor */}
        <div className="flex flex-col gap-2">
          <label className="text-[14px] font-bold text-foreground flex items-center justify-between">
            <span className="flex items-center gap-2">
              Description détaillée
              <FieldBadge variant="required" />
            </span>
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "text-[11px] font-bold tabular-nums",
                  desc.trim().length > 0 && desc.trim().length < 20
                    ? "text-red-600 dark:text-red-400"
                    : "text-muted-foreground/70",
                )}
              >
                {desc.trim().length} / 20000 · min 20
              </span>
              <button
                type="button"
                onClick={() => setShowImport((v) => !v)}
                aria-pressed={showImport}
                className={cn(
                  "text-[10px] font-bold uppercase tracking-widest border rounded px-2 py-1 transition-colors cursor-pointer",
                  showImport
                    ? "border-foreground/40 bg-muted text-foreground"
                    : "border-border/40 bg-muted/5 text-muted-foreground hover:text-foreground",
                )}
              >
                Importer
              </button>
              <button
                type="button"
                onClick={() => setPreview((p) => !p)}
                aria-pressed={preview}
                className={cn(
                  "text-[10px] font-bold uppercase tracking-widest border rounded px-2 py-1 transition-colors cursor-pointer",
                  preview
                    ? "border-foreground/40 bg-muted text-foreground"
                    : "border-border/40 bg-muted/5 text-muted-foreground hover:text-foreground",
                )}
              >
                {preview ? "Éditer" : "Aperçu"}
              </button>
            </span>
          </label>
          <span className="text-[12px] font-medium text-muted-foreground">
            Expliquez la valeur de votre produit. Structurez avec le Markdown — le gras exige{" "}
            <span className="font-mono">**texte**</span> sans espace intérieure.
          </span>
          {showImport && (
            <ReadmeImporter
              onImport={(text) => {
                setDesc(text);
                clearError("description");
              }}
            />
          )}
          <div
            className={cn(
              "w-full bg-background rounded-2xl border overflow-hidden focus-within:border-foreground/30 hover:border-foreground/20 transition-colors mt-0.5 flex flex-col group",
              descError ? "border-red-500/60" : "border-border/60",
            )}
          >
            <div className="flex items-center gap-2 px-3 py-2 bg-background border-b border-border/40">
              <button
                onClick={() => insertMarkdown("**", "**")}
                type="button"
                className="p-1.5 rounded text-muted-foreground/60 hover:bg-muted hover:text-foreground font-serif text-[15px] italic font-bold transition-colors"
              >
                B
              </button>
              <button
                onClick={() => insertMarkdown("*", "*")}
                type="button"
                className="p-1.5 rounded text-muted-foreground/60 hover:bg-muted hover:text-foreground font-serif text-[15px] italic transition-colors"
              >
                I
              </button>
              <div className="w-px h-4 bg-border/40 mx-2" />
              <button
                onClick={() => insertMarkdown("[", "](url)")}
                type="button"
                className="p-1.5 rounded text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
              >
                <Link weight="bold" className="w-4 h-4" />
              </button>
              <button
                onClick={() => insertMarkdown("- ")}
                type="button"
                className="p-1.5 rounded text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
              >
                <ListBullets weight="bold" className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-border/40 mx-2" />
              <button
                onClick={() => insertMarkdown("`", "`")}
                type="button"
                className="p-1.5 rounded text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
              >
                <Code weight="bold" className="w-4 h-4" />
              </button>
            </div>
            <textarea
              ref={textareaRef}
              name="description"
              value={desc}
              onChange={(e) => {
                setDesc(e.target.value);
                clearError("description");
              }}
              placeholder="Décrivez votre produit. Quel problème résout-il ? Pourquoi l'avez-vous construit ?&#10;&#10;Vous pouvez utiliser du Markdown pour formater le texte (gras, listes, etc)."
              rows={8}
              aria-invalid={descError ? true : undefined}
              className="w-full bg-transparent border-none px-6 py-5 text-[15px] font-medium placeholder:text-muted-foreground/30 text-foreground outline-none resize-none leading-relaxed"
            />
          </div>
          {preview && desc.trim() !== "" && (
            <div className="rounded-2xl border border-border/40 bg-muted/20 px-6 py-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                Aperçu — rendu identique à la fiche
              </p>
              <Prose>{desc}</Prose>
            </div>
          )}
          {descError && (
            <span role="alert" className="text-[12px] font-bold text-red-600 dark:text-red-400">
              {descError}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
