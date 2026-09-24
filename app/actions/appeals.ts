"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ProfileError } from "@/services/users.service";
import {
  APPEAL_MAX_BYTES,
  APPEAL_MAX_FILES,
  getAppealEligibility,
  reviewAppeal,
  submitAppeal,
} from "@/services/appeals.service";
import { adminRecipients, sendEmail } from "@/lib/email";
import {
  appealDecisionHtml,
  appealDecisionSubject,
  appealDecisionText,
} from "@/lib/email-templates/appeal-decision";
import {
  appealNotifyHtml,
  appealNotifySubject,
  appealNotifyText,
} from "@/lib/email-templates/appeal-notify";
import { captureError } from "@/lib/monitoring";
import { appOrigin } from "@/app/actions/auth";
import { requireStaffId } from "@/app/actions/admin";
import { logAdminAction } from "@/services/admin-audit.service";

export type AppealActionState = { ok: boolean; message: string | null };

// 72 h : assez pour traiter, assez court pour des pièces sensibles.
const EVIDENCE_LINK_TTL_S = 72 * 3600;

/**
 * Éligibilité au dépôt (dialog) : le bouton sait AVANT le clic.
 */
export async function getAppealEligibilityAction(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Connectez-vous." };
  try {
    return await getAppealEligibility(user.id);
  } catch {
    return { ok: false, message: "Vérification impossible." };
  }
}

/**
 * Dépose un appel (victime bannie, écran verrouillé). Fichiers :
 * images/PDF ≤ 10 Mo, 3 max — validés magic-bytes côté service.
 * L'email admin part avec des liens signés (jamais persistés).
 */
export async function submitAppealAction(
  _prev: AppealActionState,
  formData: FormData,
): Promise<AppealActionState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Connectez-vous." };
  const explanation = String(formData.get("explanation") ?? "");
  const rawFiles = formData.getAll("evidence");
  if (process.env.NODE_ENV !== "production") {
    console.error(
      `[appeal:submit] email_len=${explanation.trim().length} files=${rawFiles.length}`,
    );
  }
  const files: { buffer: Buffer; size: number }[] = [];
  for (const entry of rawFiles.slice(0, APPEAL_MAX_FILES + 1)) {
    if (!(entry instanceof File) || entry.size === 0) continue;
    if (entry.size > APPEAL_MAX_BYTES) {
      return { ok: false, message: "Pièce trop lourde (10 Mo max)." };
    }
    files.push({
      buffer: Buffer.from(await entry.arrayBuffer()),
      size: entry.size,
    });
  }
  try {
    const admin = createAdminClient();
    const { evidencePaths, seq } = await submitAppeal({
      supabase: admin,
      viewerId: user.id,
      explanation,
      files,
    });

    // Liens signés 72 h pour l'email (jamais persistés — expirent).
    const evidenceLinks: string[] = [];
    for (const path of evidencePaths) {
      try {
        const { data, error } = await admin.storage
          .from("appeals")
          .createSignedUrl(path, EVIDENCE_LINK_TTL_S);
        if (!error && data?.signedUrl) evidenceLinks.push(data.signedUrl);
      } catch {
        // Pièce listée sans lien plutôt que d'échouer tout l'envoi.
      }
    }

    const recipients = adminRecipients();
    if (recipients.length === 0) {
      captureError(new Error("ADMIN_EMAILS vide — appel sans notification"), {
        op: "appeal.notify",
      });
    } else {
      // Identité pour l'email (best-effort, jamais bloquant).
      const [row] = await db
        .select({
          username: users.username,
          displayName: users.displayName,
          banReason: users.banReason,
        })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      if (row) {
        try {
          await sendEmail({
            to: recipients,
            subject: appealNotifySubject(row.username),
            html: appealNotifyHtml({
              username: row.username,
              displayName: row.displayName,
              banReason: row.banReason ?? "Non précisé",
              explanation: explanation.trim(),
              evidenceLinks,
            }),
            text: appealNotifyText({
              username: row.username,
              displayName: row.displayName,
              banReason: row.banReason ?? "Non précisé",
              explanation: explanation.trim(),
              evidenceLinks,
            }),
          });
        } catch (e) {
          captureError(e, { op: "appeal.notify" });
        }
      }
    }
    return { ok: true, message: `Appel nº${seq} envoyé. L'équipe va l'examiner.` };
  } catch (e) {
    if (e instanceof ProfileError) return { ok: false, message: e.message };
    captureError(e, { op: "appeal.submit" });
    return { ok: false, message: "Envoi impossible pour le moment." };
  }
}

/**
 * Tranche un appel (staff) : overturned → débanni, upheld → maintien.
 * Victime notifiée dans les deux cas (best-effort).
 */
export async function reviewAppealAction(input: {
  appealId: string;
  decision: "upheld" | "overturned";
}): Promise<{ ok: boolean; message: string | null }> {
  try {
    const { id } = await requireStaffId();
    const { email, displayName, userId, overturned } = await reviewAppeal({
      isStaff: true,
      appealId: input.appealId,
      decision: input.decision,
    });
    await logAdminAction({
      actorId: id,
      targetId: userId,
      action: overturned ? "appeal_overturned" : "appeal_upheld",
    });
    try {
      const origin = await appOrigin();
      await sendEmail({
        to: email,
        subject: appealDecisionSubject(overturned),
        html: appealDecisionHtml({ displayName, overturned, origin }),
        text: appealDecisionText({ displayName, overturned, origin }),
      });
    } catch (e) {
      captureError(e, { op: "appeal.decisionEmail" });
    }
    revalidatePath("/admin/users");
    return {
      ok: true,
      message: overturned ? "Compte rétabli." : "Maintien enregistré.",
    };
  } catch (e) {
    if (e instanceof ProfileError) return { ok: false, message: e.message };
    captureError(e, { op: "appeal.review" });
    return { ok: false, message: "Décision impossible." };
  }
}
