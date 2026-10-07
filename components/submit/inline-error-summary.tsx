"use client";

import { useSubmitForm } from "@/components/submit/submit-form-context";

/**
 * Récap des erreurs inline (sous les boutons) : couvre les champs non
 * visibles (requis masqué par le type, listes) — chaque erreur y est
 * lisible même si son champ n'est pas rendu.
 */
export function InlineErrorSummary() {
  const { errors } = useSubmitForm();
  const entries = Object.entries(errors);
  if (entries.length === 0) return null;
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-500/40 bg-red-500/5 px-5 py-4 flex flex-col gap-1.5"
    >
      <p className="text-[13px] font-black text-red-600 dark:text-red-400">
        {entries.length === 1 ? "Un champ bloque l'envoi :" : "Des champs bloquent l'envoi :"}
      </p>
      <ul className="flex flex-col gap-1">
        {entries.map(([key, message]) => (
          <li key={key} className="text-[13px] font-medium text-red-600/90 dark:text-red-400/90">
            • {message}
          </li>
        ))}
      </ul>
    </div>
  );
}
