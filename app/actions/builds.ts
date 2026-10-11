"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { productBuilds, products, users } from "@/db/schema";
import { ProfileError } from "@/services/users.service";
import { listProductBuilds, reviewBuild, type BuildListItem } from "@/services/builds.service";
import { presignBuildDownload } from "@/lib/r2";
import { logAdminAction } from "@/services/admin-audit.service";
import { notifyProductMaker } from "@/services/notifications.service";
import { requireStaffId } from "@/app/actions/admin";
import { appOrigin } from "@/app/actions/auth";
import { sendEmail } from "@/lib/email";
import { captureError } from "@/lib/monitoring";
import type { ProductActionState } from "@/app/actions/products";
import {
  buildApprovedHtml,
  buildApprovedSubject,
  buildApprovedText,
  buildRejectedHtml,
  buildRejectedSubject,
  buildRejectedText,
} from "@/lib/email-templates/build-review";

export type { BuildListItem };

function versionLabelOf(b: { versionCode: number | null; versionName: string | null }): string {
  if (b.versionCode === null && !b.versionName) return "le binaire";
  return `v${b.versionName ?? "?"} (${b.versionCode ?? "?"})`;
}

/**
 * Builds + URLs de téléchargement (staff, cockpit revue) : URLs signées
 * courtes générées au rendu — jamais stockées, jamais publiques.
 */
export async function getBuildsForReview(
  productId: string,
): Promise<Array<BuildListItem & { downloadUrl: string | null; waitingHours: number }>> {
  const staff = await requireStaffId().catch(() => null);
  if (!staff) throw new ProfileError("FORBIDDEN", "Staff uniquement.");
  const builds = await listProductBuilds(productId);
  return Promise.all(
    builds.map(async (b) => {
      const waitingHours = Math.max(
        0,
        Math.floor((Date.now() - new Date(b.createdAt).getTime()) / 3_600_000),
      );
      try {
        return { ...b, downloadUrl: await presignBuildDownload(b.r2Key), waitingHours };
      } catch {
        return { ...b, downloadUrl: null, waitingHours };
      }
    }),
  );
}

async function fetchBuildMailInfo(buildId: string): Promise<{
  email: string;
  displayName: string;
  timeZone: string | null;
  productId: string;
  productName: string;
  slug: string;
  versionCode: number | null;
  versionName: string | null;
} | null> {
  const [row] = await db
    .select({
      email: users.email,
      displayName: users.displayName,
      timeZone: users.timeZone,
      productId: products.id,
      productName: products.name,
      slug: products.slug,
      versionCode: productBuilds.versionCode,
      versionName: productBuilds.versionName,
    })
    .from(productBuilds)
    .innerJoin(products, eq(products.id, productBuilds.productId))
    .innerJoin(users, eq(users.id, products.makerId))
    .where(eq(productBuilds.id, buildId))
    .limit(1);
  return row ?? null;
}

/**
 * Approbation binaire (staff) : pending → approved + notif + email maker.
 * La fiche n'est pas touchée (matrice 2×2 : axes indépendants).
 */
export async function approveBuildAction(input: { buildId: string }): Promise<ProductActionState> {
  try {
    const { id } = await requireStaffId();
    const { productId, versionCode, versionName } = await reviewBuild({
      buildId: input.buildId,
      decision: "approved",
      staffId: id,
    });
    const label = versionLabelOf({ versionCode, versionName });
    await logAdminAction({
      actorId: id,
      targetId: input.buildId,
      action: "build_approved",
      note: `${productId} ${label}`,
    });
    await notifyProductMaker(productId, "build_approved", `APK ${label} approuvé — en ligne`, id);
    try {
      const info = await fetchBuildMailInfo(input.buildId);
      const origin = await appOrigin();
      if (info) {
        await sendEmail({
          to: info.email,
          subject: buildApprovedSubject(info.productName),
          template: "build-approved",
          productId: info.productId,
          html: buildApprovedHtml({
            displayName: info.displayName,
            productName: info.productName,
            versionLabel: label,
            productUrl: `${origin}/products/${info.slug}`,
            origin,
            timeZone: info.timeZone,
          }),
          text: buildApprovedText({
            displayName: info.displayName,
            productName: info.productName,
            versionLabel: label,
            productUrl: `${origin}/products/${info.slug}`,
            origin,
            timeZone: info.timeZone,
          }),
        });
      }
    } catch (e) {
      captureError(e instanceof Error ? e : new Error(String(e)), { op: "builds.approveEmail" });
    }
    revalidatePath("/admin/review");
    return { ok: true, message: `Build ${label} approuvé.` };
  } catch (e) {
    if (e instanceof ProfileError) return { ok: false, message: e.message };
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "builds.approve" });
    return { ok: false, message: "Approbation impossible pour le moment." };
  }
}

/**
 * Rejet binaire (staff) : pending → rejected, motif OBLIGATOIRE (emailé).
 * La fiche reste en ligne (seul le binaire est concerné).
 */
export async function rejectBuildAction(input: {
  buildId: string;
  reason: string;
}): Promise<ProductActionState> {
  try {
    const { id } = await requireStaffId();
    const reason = input.reason.trim();
    if (reason === "") return { ok: false, message: "Motif requis (emailé au maker)." };
    const { productId, versionCode, versionName } = await reviewBuild({
      buildId: input.buildId,
      decision: "rejected",
      reason,
      staffId: id,
    });
    const label = versionLabelOf({ versionCode, versionName });
    await logAdminAction({
      actorId: id,
      targetId: input.buildId,
      action: "build_rejected",
      note: `${productId} ${label} : ${reason}`,
    });
    await notifyProductMaker(productId, "build_rejected", `APK ${label} rejeté — ${reason}`, id);
    try {
      const info = await fetchBuildMailInfo(input.buildId);
      const origin = await appOrigin();
      if (info) {
        await sendEmail({
          to: info.email,
          subject: buildRejectedSubject(info.productName),
          template: "build-rejected",
          productId: info.productId,
          html: buildRejectedHtml({
            displayName: info.displayName,
            productName: info.productName,
            versionLabel: label,
            reason,
            dashboardUrl: `${origin}/dashboard`,
            origin,
            timeZone: info.timeZone,
          }),
          text: buildRejectedText({
            displayName: info.displayName,
            productName: info.productName,
            versionLabel: label,
            reason,
            dashboardUrl: `${origin}/dashboard`,
            origin,
            timeZone: info.timeZone,
          }),
        });
      }
    } catch (e) {
      captureError(e instanceof Error ? e : new Error(String(e)), { op: "builds.rejectEmail" });
    }
    revalidatePath("/admin/review");
    return { ok: true, message: `Build ${label} rejeté — motif envoyé.` };
  } catch (e) {
    if (e instanceof ProfileError) return { ok: false, message: e.message };
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "builds.reject" });
    return { ok: false, message: "Rejet impossible pour le moment." };
  }
}
