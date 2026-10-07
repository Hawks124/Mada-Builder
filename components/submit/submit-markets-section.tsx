"use client";

import { useState } from "react";
import { XIcon } from "@phosphor-icons/react";
import { FieldBadge } from "@/components/ui/field-badge";
import { useSubmitForm, draftJsonList } from "@/components/submit/submit-form-context";

const MAX_COUNTRIES = 10;
const MAX_LANGUAGES = 20;
const MAX_ITEM = 60;

function normalize(raw: string): string | null {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value === "" || value.length > MAX_ITEM) return null;
  return value;
}

function TokenInput({
  label,
  hint,
  values,
  setValues,
  max,
  fieldName,
  placeholder,
}: {
  label: string;
  hint: string;
  values: string[];
  setValues: (v: string[]) => void;
  max: number;
  fieldName: string;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  const commit = (raw: string) => {
    const value = normalize(raw);
    if (!value || values.includes(value) || values.length >= max) return;
    setValues([...values, value]);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[14px] font-bold text-foreground flex items-center gap-2">
        {label}
        <FieldBadge variant="optional" />
        <span className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-black tracking-widest text-muted-foreground uppercase">
          {values.length} / {max}
        </span>
      </label>
      <p className="text-[12px] font-medium text-muted-foreground leading-relaxed">{hint}</p>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-background border border-border/60 px-4 py-3 focus-within:border-foreground/40 hover:border-foreground/20 transition-colors">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 border border-border/40 pl-3 pr-1.5 py-1 text-[13px] font-bold text-foreground"
          >
            {v}
            <button
              type="button"
              onClick={() => setValues(values.filter((x) => x !== v))}
              aria-label={`Retirer ${v}`}
              className="flex items-center justify-center w-5 h-5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <XIcon weight="bold" className="w-3 h-3" />
            </button>
          </span>
        ))}
        {values.length < max && (
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Tokenisé comme les tags : Entrée/virgule commit (l'espace
              // fait partie des noms : « Afrique du Sud », pas de commit).
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                commit(input);
                setInput("");
              } else if (e.key === "Backspace" && input === "" && values.length > 0) {
                setValues(values.slice(0, -1));
              }
            }}
            onBlur={() => {
              commit(input);
              setInput("");
            }}
            placeholder={values.length === 0 ? placeholder : ""}
            className="flex-1 min-w-32 bg-transparent border-none outline-none text-[14px] font-medium placeholder:text-muted-foreground/30 text-foreground py-1"
          />
        )}
      </div>
      <input type="hidden" name={fieldName} value={JSON.stringify(values)} />
    </div>
  );
}

/**
 * Marchés & langues — où le produit sert vraiment (vs pays du maker,
 * silencieux en V1). Tokenisé comme les tags, optionnel, pré-rempli en
 * édition. Sert le filtre « pensé pour Madagascar » de la fiche.
 */
export function SubmitMarketsSection() {
  const { editApp, draft } = useSubmitForm();
  const [countries, setCountries] = useState<string[]>(() => {
    if (editApp?.targetCountries) return editApp.targetCountries;
    return draftJsonList(draft, "targetCountries");
  });
  const [languages, setLanguages] = useState<string[]>(() => {
    if (editApp?.languagesSupported) return editApp.languagesSupported;
    return draftJsonList(draft, "languages");
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight">Marchés & langues</h2>
        <p className="text-[14px] font-medium text-muted-foreground">
          Où votre produit sert-il vraiment ? Un produit « pensé pour Madagascar » se distingue
          d&apos;un produit générique.
        </p>
      </div>

      <TokenInput
        label="Pays cibles"
        hint="Marchés servis (ex : Madagascar, France, Maurice). Entrée ou virgule pour ajouter."
        values={countries}
        setValues={setCountries}
        max={MAX_COUNTRIES}
        fieldName="targetCountries"
        placeholder="ex : Madagascar…"
      />
      <TokenInput
        label="Langues supportées"
        hint="Langues de l'interface et du contenu (ex : Français, Malagasy, English)."
        values={languages}
        setValues={setLanguages}
        max={MAX_LANGUAGES}
        fieldName="languages"
        placeholder="ex : Français…"
      />
    </div>
  );
}
