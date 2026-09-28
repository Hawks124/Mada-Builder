"use client";

import * as React from "react";
import {
  classifyForSubmit,
  verdictMessage,
  type UrlPolicy,
  type UrlVerdict,
} from "@/lib/url-verdict";

export type UrlFieldState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok"; message: string }
  | { status: "warn"; message: string }
  | { status: "block"; message: string };

/**
 * Vérification d'URL à la volée (pastille par champ) — debounce 600 ms
 * après la frappe, endpoint serveur (jamais de fetch direct : SSRF).
 * Vide = idle (pas de bruit). ÉTAT TERMINAL GARANTI : un check demandé
 * ne retombe jamais au silence — échec inattendu = warn visible (le
 * serveur re-vérifie TOUJOURS au submit : ceci est du feedback, jamais
 * une autorisation).
 */
export function useUrlCheck(value: string, opts?: { disabled?: boolean }): UrlFieldState {
  const [state, setState] = React.useState<UrlFieldState>({ status: "idle" });
  const seq = React.useRef(0);
  const disabled = opts?.disabled ?? false;

  React.useEffect(() => {
    const current = ++seq.current;
    // TOUT est async (callback debounce) : aucun setState synchrone dans
    // le corps de l'effect (règle react-hooks — même pattern que le rAF
    // du modal "comment ça marche"). Délai idle ≤ 600 ms, imperceptible.
    const timer = setTimeout(async () => {
      if (seq.current !== current) return;
      const url = value.trim();
      if (disabled || url === "") {
        setState({ status: "idle" });
        return;
      }
      // Erreur dure immédiate, sans réseau (même règle que le serveur).
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          setState({ status: "block", message: "Adresse invalide (http(s) uniquement)." });
          return;
        }
      } catch {
        // URL incomplète en cours de frappe : idle, pas d'erreur.
        setState({ status: "idle" });
        return;
      }
      setState({ status: "checking" });
      try {
        const res = await fetch("/api/v1/urls/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        if (seq.current !== current) return;
        const json = (await res.json().catch(() => null)) as {
          ok: boolean;
          code?: string;
          message?: string;
          data?: { verdict?: UrlVerdict };
        } | null;
        const verdict = json?.data?.verdict;
        if (json?.ok && verdict) {
          const policy: UrlPolicy = classifyForSubmit(verdict);
          if (policy === "ok") setState({ status: "ok", message: verdictMessage(verdict) });
          else if (policy === "warn")
            setState({ status: "warn", message: verdictMessage(verdict) });
          else setState({ status: "block", message: verdictMessage(verdict) });
          return;
        }
        // Erreur endpoint (401, 429, 500…) : message serveur si présent,
        // sinon warn générique — JAMAIS de retour au silence.
        setState({
          status: "warn",
          message:
            typeof json?.message === "string" && json.message !== ""
              ? json.message
              : "Vérification impossible pour le moment — la revue tranchera.",
        });
      } catch {
        if (seq.current === current) {
          setState({
            status: "warn",
            message: "Vérification impossible pour le moment — la revue tranchera.",
          });
        }
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [value, disabled]);

  return state;
}
