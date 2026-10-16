"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSubmitForm } from "@/components/submit/submit-form-context";
import { clearSubmitDraft } from "@/components/submit/submit-draft";
import { compressImage } from "@/components/submit/compress-image";
import { focusFirstError, validateSubmitClient } from "@/components/submit/validate-submit";
import type { PendingApk } from "@/components/submit/submit-apk-section";
import { uploadApkBuild, APK_UPLOAD_STEP_LABEL } from "@/components/submit/apk-upload";

export type SendPhase =
  | { name: "idle" }
  | { name: "preparing" }
  | {
      name: "uploading";
      loaded: number;
      total: number;
      origBytes?: number;
      sentBytes?: number;
      detail?: string | null;
    }
  | { name: "processing" }
  | { name: "success" };

/**
 * Envoi XHR (vrai %) : validation inline d'abord (erreurs + focus),
 * puis `POST /api/submit` avec clé d'idempotence par tentative.
 * PAS de soumission native : l'état React/DOM n'est jamais touché par
 * l'aller-retour (fini les champs vidés à l'erreur). Succès → toast +
 * redirection client (mêmes destinations que les actions).
 */
export function useSubmitXhr(
  formRef: React.RefObject<HTMLFormElement | null>,
  opts?: { pendingApk?: PendingApk | null },
) {
  const router = useRouter();
  const ctx = useSubmitForm();
  const [phase, setPhase] = React.useState<SendPhase>({ name: "idle" });
  const [serverMessage, setServerMessage] = React.useState<string | null>(null);
  const [activeIntent, setActiveIntent] = React.useState<"publish" | "draft" | null>(null);
  const sending = phase.name !== "idle";
  const pendingApk = opts?.pendingApk ?? null;

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
        requirements: jsonArr("requirements"),
        revenue: {
          key: fields.revenueKey ?? "",
          provider: fields.revenueProvider ?? "stripe",
          projectId: fields.revenueProjectId ?? "",
          storeId: fields.revenueStoreId ?? "",
        },
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
      /**
       * Chaîne first-upload (D2-UI) : presign web → PUT R2 direct (% réel)
       * → record build (`pending`, revue bloquante). Succès comme échec =
       * redirect dashboard (la fiche est sauvée dans tous les cas).
       */
      const chainApkUpload = async (
        apk: PendingApk,
        productId: string,
        editing: boolean,
      ): Promise<void> => {
        const done = (toast: string) => {
          setPhase({ name: "idle" });
          clearSubmitDraft();
          router.push(`/dashboard?toast=ok:${encodeURIComponent(toast)}`);
        };
        try {
          setPhase({ name: "uploading", loaded: 0, total: apk.file.size, detail: null });
          // Premier build : pas de notes (pas de track) — whatsnew null.
          await uploadApkBuild({
            productId,
            pending: apk,
            whatsnew: null,
            onProgress: (loaded, total) =>
              setPhase((prev) => ({
                name: "uploading",
                loaded,
                total,
                detail: prev.name === "uploading" ? prev.detail : null,
              })),
            onStep: (step) =>
              setPhase((prev) => {
                const base =
                  prev.name === "uploading"
                    ? { loaded: prev.loaded, total: prev.total }
                    : { loaded: 0, total: apk.file.size };
                return {
                  name: "uploading",
                  ...base,
                  detail: APK_UPLOAD_STEP_LABEL[step],
                };
              }),
          });
          // Succès visible (D6) : vert ~900 ms avant redirect — jamais de
          // bascule brutale depuis 100 %.
          setPhase({ name: "success" });
          await new Promise((r) => setTimeout(r, 900));
          done(
            editing
              ? "Fiche mise à jour — APK en revue avec elle."
              : "Produit soumis — APK en revue avec la fiche.",
          );
        } catch {
          // Fiche sauvée, binaire en rattrapage dashboard (jamais bloquant).
          done(
            editing
              ? "Fiche mise à jour — l'APK n'a pas pu être envoyé, retrouvez-le depuis Mes produits."
              : "Produit soumis — l'APK n'a pas pu être envoyé, ajoutez-le depuis le dashboard.",
          );
        }
      };
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/submit");
      xhr.setRequestHeader("Idempotency-Key", crypto.randomUUID());
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setPhase({ name: "uploading", loaded: e.loaded, total: e.total });
      };
      xhr.onload = () => {
        let body: {
          ok?: boolean;
          data?: { id?: string; slug?: string; status?: string; rereview?: boolean };
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
          const productId =
            typeof body.data.id === "string" && body.data.id !== ""
              ? body.data.id
              : (ctx.editApp?.id ?? null);
          // First-upload (D2-UI + D6) : la fiche existe (productId connu) →
          // R2 direct (PUT présigné, jamais via Vercel) puis record. En
          // création : publish seul (brouillon = textes seuls). En édition :
          // tout save réussi (rattrapage sans track). Échec = fiche sauvée
          // + rattrapage dashboard (jamais bloquant).
          const apk = pendingApk && (intent === "publish" || ctx.isEditing) ? pendingApk : null;
          // TEMP CHAIN-DEBUG — retirer après diagnostic.
          if (typeof console !== "undefined") {
            console.log(
              `[apk-chain] submit ok — apk=${apk ? apk.file.name : "AUCUN"} productId=${productId ?? "MANQUANT"} intent=${intent}`,
            );
          }
          if (apk && productId) {
            void chainApkUpload(apk, productId, ctx.isEditing);
            return;
          }
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
    [ctx, formRef, router, sending, pendingApk],
  );

  return { phase, sending, serverMessage, activeIntent, send };
}
