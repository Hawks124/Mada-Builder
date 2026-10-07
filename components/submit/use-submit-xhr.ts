"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSubmitForm } from "@/components/submit/submit-form-context";
import { clearSubmitDraft } from "@/components/submit/submit-draft";
import { compressImage } from "@/components/submit/compress-image";
import { focusFirstError, validateSubmitClient } from "@/components/submit/validate-submit";

export type SendPhase =
  | { name: "idle" }
  | { name: "preparing" }
  | { name: "uploading"; loaded: number; total: number; origBytes?: number; sentBytes?: number }
  | { name: "processing" };

/**
 * Envoi XHR (vrai %) : validation inline d'abord (erreurs + focus),
 * puis `POST /api/submit` avec clé d'idempotence par tentative.
 * PAS de soumission native : l'état React/DOM n'est jamais touché par
 * l'aller-retour (fini les champs vidés à l'erreur). Succès → toast +
 * redirection client (mêmes destinations que les actions).
 */
export function useSubmitXhr(formRef: React.RefObject<HTMLFormElement | null>) {
  const router = useRouter();
  const ctx = useSubmitForm();
  const [phase, setPhase] = React.useState<SendPhase>({ name: "idle" });
  const [serverMessage, setServerMessage] = React.useState<string | null>(null);
  const [activeIntent, setActiveIntent] = React.useState<"publish" | "draft" | null>(null);
  const sending = phase.name !== "idle";

  const send = React.useCallback(
    async (intent: "publish" | "draft") => {
      const form = formRef.current;
      if (!form || sending) return;
      setServerMessage(null);
      const fd = new FormData(form);
      fd.set("intent", intent);
      if (ctx.isEditing && ctx.editApp) fd.set("productId", ctx.editApp.id);

      const jsonArr = (key: string): string[] => {
        const v = fd.get(key);
        if (typeof v !== "string" || v.trim() === "") return [];
        try {
          const parsed: unknown = JSON.parse(v);
          return Array.isArray(parsed)
            ? parsed.filter((x): x is string => typeof x === "string")
            : [];
        } catch {
          return [];
        }
      };
      const fields: Record<string, string> = {};
      for (const [k, v] of fd.entries()) {
        if (typeof v === "string" && !(k in fields)) fields[k] = v;
      }
      const fieldErrors = validateSubmitClient({
        intent,
        fields,
        productType: ctx.productType,
        audience: ctx.audience,
        pricing: ctx.pricing,
        categories: jsonArr("categories"),
        tags: jsonArr("tags"),
        platforms: jsonArr("platforms"),
        targetCountries: jsonArr("targetCountries"),
        languages: jsonArr("languages"),
        linkValues: Object.fromEntries(
          Object.entries(ctx.linkValues).filter(([, v]) => typeof v === "string"),
        ) as Record<string, string>,
        linkPolicies: ctx.linkPolicies,
        media: ctx.mediaSummary,
        isEditing: ctx.isEditing,
        editingDraft: (ctx.editApp?.status as string | undefined) === "draft",
      });
      if (Object.keys(fieldErrors).length > 0) {
        ctx.setErrors(fieldErrors);
        // Focus après peinture des erreurs (sinon l'élément n'existe pas).
        requestAnimationFrame(() => focusFirstError(fieldErrors));
        return;
      }
      ctx.setErrors({});

      setActiveIntent(intent);
      // Brouillon en CRÉATION : textes seuls (décision — les images ne
      // sont jamais uploadées en draft : rapide + aucun orphelin).
      // En édition, les fichiers re-sélectionnés partent (remplacement).
      if (intent === "draft" && !ctx.isEditing) {
        fd.delete("logo");
        fd.delete("screenshots");
      }
      setPhase({ name: "preparing" });
      // Compression navigateur (WebP q0.82) : le publish arrête de ramer.
      // Fallback = originaux (le serveur re-valide tout).
      let origBytes = 0;
      let sentBytes = 0;
      try {
        const logoRaw = fd.get("logo");
        if (logoRaw instanceof File && logoRaw.size > 0) {
          origBytes += logoRaw.size;
          const compressed = await compressImage(logoRaw);
          sentBytes += compressed.size;
          fd.set("logo", compressed);
        }
        const shots = fd
          .getAll("screenshots")
          .filter((v): v is File => v instanceof File && v.size > 0);
        if (shots.length > 0) {
          fd.delete("screenshots");
          for (const s of shots) {
            origBytes += s.size;
            const compressed = await compressImage(s);
            sentBytes += compressed.size;
            fd.append("screenshots", compressed);
          }
        }
      } catch {
        // Compression en panne : originaux (jamais bloquant).
      }
      setPhase({ name: "uploading", loaded: 0, total: 1, origBytes, sentBytes });
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/submit");
      xhr.setRequestHeader("Idempotency-Key", crypto.randomUUID());
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setPhase({ name: "uploading", loaded: e.loaded, total: e.total });
      };
      xhr.onload = () => {
        let body: {
          ok?: boolean;
          data?: { slug?: string; status?: string; rereview?: boolean };
          message?: string;
        } = {};
        try {
          body = JSON.parse(xhr.responseText) as typeof body;
        } catch {
          body = {};
        }
        if (xhr.status >= 200 && xhr.status < 300 && body.ok && body.data) {
          const status = body.data.status ?? (intent === "publish" ? "pending" : "draft");
          const submitted = status === "pending";
          const toast = ctx.isEditing
            ? submitted
              ? "Produit soumis — en revue sous 24 h."
              : body.data.rereview
                ? "Modifications envoyées en re-revue."
                : "Fiche mise à jour."
            : status === "draft"
              ? "Brouillon enregistré."
              : "Produit soumis — en revue sous 24 h.";
          setPhase({ name: "idle" });
          clearSubmitDraft();
          // Brouillon → section brouillons (pas le dashboard général).
          const dest = status === "draft" ? "/dashboard/drafts" : "/dashboard";
          router.push(`${dest}?toast=ok:${encodeURIComponent(toast)}`);
          return;
        }
        setPhase({ name: "idle" });
        const message =
          typeof body.message === "string" && body.message !== ""
            ? body.message
            : "Envoi impossible pour le moment.";
        setServerMessage(message);
      };
      xhr.onerror = () => {
        setPhase({ name: "idle" });
        setServerMessage("Connexion interrompue — vérifiez votre réseau puis réessayez.");
      };
      xhr.ontimeout = () => {
        setPhase({ name: "idle" });
        setServerMessage("Délai dépassé — réessayez (vos champs sont conservés).");
      };
      // Dernier octet envoyé, serveur au travail (sharp + R2, non mesurable).
      xhr.upload.onload = () => setPhase({ name: "processing" });
      xhr.send(fd);
    },
    [ctx, formRef, router, sending],
  );

  return { phase, sending, serverMessage, activeIntent, send };
}
