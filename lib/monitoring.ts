import * as Sentry from "@sentry/nextjs";

/**
 * Façade observabilité — tout le code applicatif passe par ici,
 * jamais d'import *Sentry* direct hors lib/ et instrumentation.
 * Changer de vendor (Sentry → autre) = réécrire ce seul fichier.
 *
 * Actif en production uniquement (gating `enabled`), sauf override
 * explicite via SENTRY_FORCE_ENABLED=1 (debug ciblé).
 */
function isEnabled(): boolean {
  if (process.env.SENTRY_FORCE_ENABLED === "1") return true;
  return process.env.NODE_ENV === "production";
}

export function captureError(error: unknown, context?: Record<string, unknown>): string | undefined {
  if (!isEnabled()) return undefined;
  return Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
): string | undefined {
  if (!isEnabled()) return undefined;
  return Sentry.captureMessage(message, level);
}

/** Contexte user minimal (id uniquement — jamais d'email/PII, §16). */
export function setMonitoringUser(id: string | null): void {
  if (!isEnabled()) return;
  Sentry.setUser(id ? { id } : null);
}
