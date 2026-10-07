"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { getSessionUser } from "@/lib/supabase/server";
import { ProfileError } from "@/services/users.service";
import {
  deleteMyProduct,
  deleteProductAsAdmin,
  fetchAdminProducts,
  fetchMyProducts,
  fetchNudgeTarget,
  fetchProductAdminStatus,
  fetchReviewItem,
  fetchReviewQueue,
  NUDGE_COOLDOWN_DAYS,
  parseProductLinkFields,
  reviewProduct,
  submitProduct,
  updateProduct,
} from "@/services/products.service";
import { getUserVotedIds, toggleVote } from "@/services/votes.service";
import { findPublishedIdBySlug, setFeaturedOverride } from "@/services/ranking.service";
import { logAdminAction } from "@/services/admin-audit.service";
import { notifyProductMaker } from "@/services/notifications.service";
import { requireStaffId } from "@/app/actions/admin";
import { sendEmail } from "@/lib/email";
import {
  productApprovedHtml,
  productApprovedSubject,
  productApprovedText,
  productRejectedHtml,
  productRejectedSubject,
  productRejectedText,
} from "@/lib/email-templates/product-review";
import {
  productRemovedHtml,
  productRemovedSubject,
  productRemovedText,
} from "@/lib/email-templates/product-removed";
import {
  productNudgeHtml,
  productNudgeSubject,
  productNudgeText,
} from "@/lib/email-templates/product-nudge";
import { appOrigin } from "@/app/actions/auth";
import { withToast } from "@/lib/toast";
import { captureError } from "@/lib/monitoring";

export type ProductActionState = {
  ok: boolean;
  message: string | null;
  slug?: string;
  productId?: string;
};

function parseJsonArray(raw: FormDataEntryValue | null, label: string): string[] {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  // Malformé = 422 nommé (jamais de défaut silencieux qui changerait le sens).
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new ProfileError("VALIDATION", `Champ ${label} invalide.`);
    return parsed.filter((v): v is string => typeof v === "string");
  } catch (e) {
    if (e instanceof ProfileError) throw e;
    throw new ProfileError("VALIDATION", `Champ ${label} invalide.`);
  }
}

function parseBool(raw: FormDataEntryValue | null): boolean {
  return raw === "true" || raw === "on" || raw === "1";
}

function str(raw: FormDataEntryValue | null): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}
export async function submitProductAction(
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/signin?next=/products/submit");
  const intent = formData.get("intent");
  // redirect() lève NEXT_REDIRECT : jamais dans le try (le catch
  // l'avalerait → échec affiché après un submit réussi + bruit Sentry).
  let result: { id: string; slug: string; status: string };
  try {
    const links = parseProductLinkFields(formData) ?? {};
    const logoRaw = formData.get("logo");
    const logo = logoRaw instanceof File && logoRaw.size > 0 ? logoRaw : null;
    const screenshots = formData
      .getAll("screenshots")
      .filter((v): v is File => v instanceof File && v.size > 0);
    result = await submitProduct({
      viewerId: user.id,
      data: {
        name: str(formData.get("name")),
        tagline: str(formData.get("tagline")),
        description: str(formData.get("description")),
        productType: str(formData.get("productType")),
        lifecycle: str(formData.get("lifecycle")),
        audience: str(formData.get("audience")),
        category: str(formData.get("category")),
        categories: parseJsonArray(formData.get("categories"), "cat�gories"),
        tags: parseJsonArray(formData.get("tags"), "tags"),
        platforms: parseJsonArray(formData.get("platforms"), "plateformes"),
        pricingModel: str(formData.get("pricing")),
        license: str(formData.get("license")),
        installCommand: str(formData.get("installCommand")),
        version: str(formData.get("version")),
        requirements: str(formData.get("requirements")),
        changelogUrl: str(formData.get("changelogUrl")),
        hasAds: parseBool(formData.get("hasAds")),
        sharesData: parseBool(formData.get("hasThirdParty")),
        hasInAppPurchase: false,
        isChildDirected: str(formData.get("audience")) === "kids",
        targetCountries: parseJsonArray(formData.get("targetCountries"), "pays cibles"),
        languagesSupported: parseJsonArray(formData.get("languages"), "langues"),
        galleryOrientation: str(formData.get("galleryOrientation")),
        links,
      },
      logo,
      screenshots,
      asDraft: intent !== "publish",
    });
  } catch (e) {
    if (e instanceof ProfileError) return { ok: false, message: e.message };
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "products.submit" });
    return { ok: false, message: "Soumission impossible pour le moment." };
  }
  revalidatePath("/dashboard");
  redirect(
    withToast(
      "/dashboard",
      "ok",
      result.status === "draft" ? "Brouillon enregistré." : "Produit soumis — en revue sous 24 h.",
    ),
  );
}

/**
 * Édition maker : textes directs, nom/liens d'une fiche published →
 * retour pending (service). Redirige vers la fiche ou le dashboard.
 */
export async function updateProductAction(
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  const productId = str(formData.get("productId"));
  if (!productId) return { ok: false, message: "Produit introuvable." };
  // redirect() hors try (cf. submit : NEXT_REDIRECT avalé sinon).
  let result: { slug: string; rereview: boolean };
  try {
    const logoRaw = formData.get("logo");
    const logo = logoRaw instanceof File && logoRaw.size > 0 ? logoRaw : null;
    const screenshots = formData
      .getAll("screenshots")
      .filter((v): v is File => v instanceof File && v.size > 0);
    result = await updateProduct(
      user.id,
      productId,
      {
        name: str(formData.get("name")),
        tagline: str(formData.get("tagline")),
        description: str(formData.get("description")),
        productType: str(formData.get("productType")),
        lifecycle: str(formData.get("lifecycle")),
        audience: str(formData.get("audience")),
        category: str(formData.get("category")),
        categories:
          formData.get("categories") === null
            ? undefined
            : parseJsonArray(formData.get("categories"), "cat�gories"),
        tags:
          formData.get("tags") === null ? undefined : parseJsonArray(formData.get("tags"), "tags"),
        platforms:
          formData.get("platforms") === null
            ? undefined
            : parseJsonArray(formData.get("platforms"), "plateformes"),
        pricingModel: str(formData.get("pricing")),
        license: str(formData.get("license")),
        installCommand: str(formData.get("installCommand")),
        version: str(formData.get("version")),
        requirements: str(formData.get("requirements")),
        changelogUrl: str(formData.get("changelogUrl")),
        hasAds: formData.get("hasAds") === null ? undefined : parseBool(formData.get("hasAds")),
        targetCountries:
          formData.get("targetCountries") === null
            ? undefined
            : parseJsonArray(formData.get("targetCountries"), "pays cibles"),
        languagesSupported:
          formData.get("languages") === null
            ? undefined
            : parseJsonArray(formData.get("languages"), "langues"),
        sharesData:
          formData.get("hasThirdParty") === null
            ? undefined
            : parseBool(formData.get("hasThirdParty")),
        galleryOrientation:
          formData.get("galleryOrientation") === null
            ? undefined
            : str(formData.get("galleryOrientation")),
        links: parseProductLinkFields(formData),
      },
      { logo, screenshots },
    );
  } catch (e) {
    if (e instanceof ProfileError) return { ok: false, message: e.message };
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "products.update" });
    return { ok: false, message: "Enregistrement impossible pour le moment." };
  }
  revalidatePath(`/products/${result.slug}`);
  revalidatePath("/dashboard");
  redirect(
    withToast(
      "/dashboard",
      "ok",
      result.rereview ? "Modifications envoyées en re-revue." : "Fiche mise à jour.",
    ),
  );
}

/** Suppression maker (RGPD) — irréversible, confirmée côté UI. */
export async function deleteMyProductAction(input: {
  productId: string;
}): Promise<ProductActionState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Connectez-vous." };
  try {
    await deleteMyProduct(user.id, input.productId);
    revalidatePath("/dashboard");
    return { ok: true, message: "Produit supprimé définitivement." };
  } catch (e) {
    if (e instanceof ProfileError) return { ok: false, message: e.message };
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "products.deleteMine" });
    return { ok: false, message: "Suppression impossible pour le moment." };
  }
}

/** Suppression admin (arme lourde — confirm + motif côté UI, maker notifié). */
export async function deleteProductAsAdminAction(input: {
  productId: string;
  reason: string;
}): Promise<ProductActionState> {
  try {
    const { id } = await requireStaffId();
    const reason = input.reason.trim();
    if (reason === "") return { ok: false, message: "Motif requis (emailé au maker)." };
    const { email, displayName, productName, timeZone } = await deleteProductAsAdmin({
      isStaff: true,
      productId: input.productId,
    });
    await logAdminAction({
      actorId: id,
      targetId: input.productId,
      action: "product_removed",
      note: `${productName} : ${reason}`,
    });
    await notifyProductMaker(
      input.productId,
      "product_removed",
      `${productName} a été retiré — ${reason}`,
      id,
    );
    try {
      const origin = await appOrigin();
      await sendEmail({
        to: email,
        subject: productRemovedSubject(productName),
        template: "product-removed",
        productId: input.productId,
        html: productRemovedHtml({
          displayName,
          productName,
          reason,
          dashboardUrl: `${origin}/dashboard`,
          origin,
          timeZone,
        }),
        text: productRemovedText({
          displayName,
          productName,
          reason,
          dashboardUrl: `${origin}/dashboard`,
          origin,
          timeZone,
        }),
      });
    } catch (e) {
      captureError(e instanceof Error ? e : new Error(String(e)), { op: "products.removeEmail" });
    }
    revalidatePath("/admin/products");
    return { ok: true, message: "Produit retiré — motif envoyé." };
  } catch (e) {
    if (e instanceof ProfileError) return { ok: false, message: e.message };
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "products.deleteAdmin" });
    return { ok: false, message: "Retrait impossible pour le moment." };
  }
}

/**
 * Approbation (staff) : pending → published + email maker (fiche).
 * Victime notifiée best-effort, jamais bloquante.
 */
export async function approveProductAction(input: {
  productId: string;
}): Promise<ProductActionState> {
  try {
    const { id } = await requireStaffId();
    const { email, displayName, productName, timeZone } = await reviewProduct({
      isStaff: true,
      productId: input.productId,
      decision: "approved",
    });
    await logAdminAction({
      actorId: id,
      targetId: input.productId,
      action: "product_published",
      note: productName,
    });
    await notifyProductMaker(
      input.productId,
      "product_approved",
      `${productName} a été approuvé`,
      id,
    );
    try {
      const origin = await appOrigin();
      const [row] = await fetchMyProductsForEmail(input.productId);
      await sendEmail({
        to: email,
        subject: productApprovedSubject(productName),
        template: "product-approved",
        productId: input.productId,
        html: productApprovedHtml({
          displayName,
          productName,
          productUrl: `${origin}/products/${row?.slug ?? ""}`,
          origin,
          timeZone,
        }),
        text: productApprovedText({
          displayName,
          productName,
          productUrl: `${origin}/products/${row?.slug ?? ""}`,
          origin,
          timeZone,
        }),
      });
    } catch (e) {
      captureError(e instanceof Error ? e : new Error(String(e)), { op: "products.approveEmail" });
    }
    revalidatePath("/admin/review");
    revalidatePath("/");
    return { ok: true, message: `${productName} publié.` };
  } catch (e) {
    if (e instanceof ProfileError) return { ok: false, message: e.message };
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "products.approve" });
    return { ok: false, message: "Approbation impossible pour le moment." };
  }
}

async function fetchMyProductsForEmail(productId: string): Promise<Array<{ slug: string }>> {
  return db
    .select({ slug: products.slug })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
}

/**
 * Rejet (staff) : pending → rejected, motif OBLIGATOIRE (emailé).
 */
export async function rejectProductAction(input: {
  productId: string;
  reason: string;
}): Promise<ProductActionState> {
  try {
    const { id } = await requireStaffId();
    const reason = input.reason.trim();
    if (reason === "") return { ok: false, message: "Motif requis (emailé au maker)." };
    const { email, displayName, productName, timeZone } = await reviewProduct({
      isStaff: true,
      productId: input.productId,
      decision: "rejected",
      reason,
    });
    await logAdminAction({
      actorId: id,
      targetId: input.productId,
      action: "product_rejected",
      note: `${productName} : ${reason}`,
    });
    await notifyProductMaker(
      input.productId,
      "product_rejected",
      `${productName} a été rejeté — ${reason}`,
      id,
    );
    try {
      const origin = await appOrigin();
      await sendEmail({
        to: email,
        subject: productRejectedSubject(productName),
        template: "product-rejected",
        productId: input.productId,
        html: productRejectedHtml({
          displayName,
          productName,
          reason,
          dashboardUrl: `${origin}/dashboard`,
          origin,
          timeZone,
        }),
        text: productRejectedText({
          displayName,
          productName,
          reason,
          dashboardUrl: `${origin}/dashboard`,
          origin,
          timeZone,
        }),
      });
    } catch (e) {
      captureError(e instanceof Error ? e : new Error(String(e)), { op: "products.rejectEmail" });
    }
    revalidatePath("/admin/review");
    return { ok: true, message: `${productName} rejeté — motif envoyé.` };
  } catch (e) {
    if (e instanceof ProfileError) return { ok: false, message: e.message };
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "products.reject" });
    return { ok: false, message: "Rejet impossible pour le moment." };
  }
}

/**
 * Rappel maker (section Rejetés) : email bienveillant + audit `product_nudged`.
 * Anti-spam : refus poli si le dernier rappel date de moins de
 * NUDGE_COOLDOWN_DAYS jours. Produit resoumis entre-temps → refus
 * (fetchNudgeTarget throw). Le bouton UI est déjà verrouillé, ceci est la
 * barrière serveur (jamais de confiance au seul UI).
 */
export async function nudgeMakerAction(input: { productId: string }): Promise<ProductActionState> {
  try {
    const { id } = await requireStaffId();
    const target = await fetchNudgeTarget(input.productId);
    if (target.lastNudgedDays !== null && target.lastNudgedDays < NUDGE_COOLDOWN_DAYS) {
      return {
        ok: false,
        message: `Rappel déjà envoyé il y a ${target.lastNudgedDays} j — réessayez dans ${NUDGE_COOLDOWN_DAYS - target.lastNudgedDays} j.`,
      };
    }
    try {
      const origin = await appOrigin();
      await sendEmail({
        to: target.makerEmail,
        subject: productNudgeSubject(target.productName),
        template: "product-nudge",
        productId: input.productId,
        html: productNudgeHtml({
          displayName: target.makerDisplayName,
          productName: target.productName,
          reason: target.reason,
          rejectedDays: target.rejectedDays,
          dashboardUrl: `${origin}/dashboard`,
          origin,
          timeZone: target.makerTimeZone,
        }),
        text: productNudgeText({
          displayName: target.makerDisplayName,
          productName: target.productName,
          reason: target.reason,
          rejectedDays: target.rejectedDays,
          dashboardUrl: `${origin}/dashboard`,
          origin,
          timeZone: target.makerTimeZone,
        }),
      });
    } catch (e) {
      captureError(e instanceof Error ? e : new Error(String(e)), { op: "products.nudgeEmail" });
      return { ok: false, message: "Envoi impossible pour le moment." };
    }
    await logAdminAction({
      actorId: id,
      targetId: input.productId,
      action: "product_nudged",
      note: `${target.productName} : rappel après ${target.rejectedDays} j de rejet`,
    });
    revalidatePath("/admin/rejected");
    return { ok: true, message: `Rappel envoyé à ${target.makerDisplayName}.` };
  } catch (e) {
    if (e instanceof ProfileError) return { ok: false, message: e.message };
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "products.nudge" });
    return { ok: false, message: "Rappel impossible pour le moment." };
  }
}

/**
 * Toggle veille (staff) : bascule `curated` (veille internationale ↔
 * scène locale). Sortie du jeu (classement/featured/votes/avis) ou
 * retour, avec revalidation des pages concernées.
 */
export async function setProductCuratedAction(input: {
  productId: string;
  curated: boolean;
}): Promise<ProductActionState> {
  try {
    await requireStaffId();
    const [row] = await db
      .select({ id: products.id, slug: products.slug })
      .from(products)
      .where(and(eq(products.id, input.productId), isNull(products.deletedAt)))
      .limit(1);
    if (!row) return { ok: false, message: "Produit introuvable." };
    await db.update(products).set({ curated: input.curated }).where(eq(products.id, row.id));
    revalidatePath("/admin/products");
    revalidatePath(`/products/${row.slug}`);
    revalidatePath("/leaderboard");
    revalidatePath("/");
    return {
      ok: true,
      message: input.curated ? "Produit passé en veille." : "Produit de retour dans le jeu.",
    };
  } catch (e) {
    if (e instanceof ProfileError) return { ok: false, message: e.message };
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "products.curated" });
    return { ok: false, message: "Opération impossible." };
  }
}

// ── Votes (§11) ─────────────────────────────────────────────────────────
export type VoteActionState = {
  ok: boolean;
  voted: boolean;
  upvoteCount: number;
  /** Poids > 0 ? Faux = shadow-weighting (affiché, hors classement). */
  counted: boolean;
  message: string | null;
  /** Code machine (ex. "account_too_young") — le client matche ça, pas le texte. */
  reason?: string;
};

/** IP best-effort (anti-burst, jamais bloquante si illisible — c.f. makers). */
async function clientIp(): Promise<string | null> {
  try {
    const { headers } = await import("next/headers");
    const list = await headers();
    const forwarded = list.get("x-forwarded-for");
    return forwarded?.split(",")[0]?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Toggle vote (optimiste côté UI, réconcilié sur le retour) : 1/user,
 * réversible, auth exigée (le mur redirige sinon — jamais d'appel ici
 * sans session).
 */
export async function toggleVoteAction(input: { productId: string }): Promise<VoteActionState> {
  const user = await getSessionUser();
  if (!user)
    return {
      ok: false,
      voted: false,
      upvoteCount: 0,
      counted: false,
      message: "Connectez-vous pour voter.",
    };
  try {
    const ip = await clientIp();
    const res = await toggleVote({ viewerId: user.id, productId: input.productId, ip });
    revalidatePath("/leaderboard");
    revalidatePath("/");
    return { ok: true, ...res, message: null };
  } catch (e) {
    if (e instanceof ProfileError) {
      const details = e.details as { reason?: unknown } | undefined;
      const reason = typeof details?.reason === "string" ? details.reason : undefined;
      return {
        ok: false,
        voted: false,
        upvoteCount: 0,
        counted: false,
        message: e.message,
        ...(reason ? { reason } : {}),
      };
    }
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "products.vote" });
    return {
      ok: false,
      voted: false,
      upvoteCount: 0,
      counted: false,
      message: "Vote impossible pour le moment.",
    };
  }
}

/** Votes de l'auteur (badges initiaux, 1 requête) — vide si déconnecté. */
export async function getMyVotedIds(productIds: string[]): Promise<string[]> {
  const user = await getSessionUser();
  if (!user) return [];
  try {
    return [...(await getUserVotedIds(user.id, productIds))];
  } catch {
    return [];
  }
}

/** Override admin du produit du jour (épingle / lève). */
export async function setFeaturedOverrideAction(input: {
  productId: string | null;
}): Promise<ProductActionState> {
  try {
    const { id } = await requireStaffId();
    const { productId, previousProductId } = await setFeaturedOverride({
      isStaff: true,
      productId: input.productId,
    });
    // Audit sur la fiche concernée (épinglée ou dé-épinglée) ; no-op sans cible = rien à tracer.
    const target = productId ?? previousProductId;
    if (target) {
      await logAdminAction({
        actorId: id,
        targetId: target,
        action: "product_featured",
        note: productId ? `featured épinglé : ${productId}` : "featured épinglage levé",
      });
    }
    revalidatePath("/");
    return { ok: true, message: productId ? "Produit du jour épinglé." : "Épinglage levé." };
  } catch (e) {
    if (e instanceof ProfileError) return { ok: false, message: e.message };
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "products.featured" });
    return { ok: false, message: "Épinglage impossible pour le moment." };
  }
}

/** Variante slug (formulaire admin — jamais d'uuid tapé à la main). */
export async function setFeaturedOverrideBySlugAction(input: {
  slug: string;
}): Promise<ProductActionState> {
  try {
    await requireStaffId();
    const slug = input.slug.trim().toLowerCase();
    if (!slug) return { ok: false, message: "Slug requis." };
    const productId = await findPublishedIdBySlug(slug);
    if (!productId) return { ok: false, message: "Fiche publiée introuvable pour ce slug." };
    return await setFeaturedOverrideAction({ productId });
  } catch (e) {
    if (e instanceof ProfileError) return { ok: false, message: e.message };
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "products.featuredSlug" });
    return { ok: false, message: "Épinglage impossible pour le moment." };
  }
}

// ── Lectures (pages) ──────────────────────────────────────────────────────
export async function getMyProductsList() {
  const user = await getSessionUser();
  if (!user) return [];
  try {
    const { items } = await fetchMyProducts(user.id);
    return items;
  } catch (e) {
    // Même règle qu'en revue : jamais de dashboard vide mensonger.
    if (e instanceof ProfileError) throw e;
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "products.mine" });
    throw new Error("Vos produits sont indisponibles pour le moment.");
  }
}

export async function getReviewQueueList() {
  try {
    const { id, role } = await requireStaffId();
    void id;
    void role;
    return await fetchReviewQueue({ isStaff: true });
  } catch (e) {
    // Jamais de file vide mensongère sur incident : ProfileError remonte
    // (dont le refus staff), l'inattendu devient une erreur visible.
    if (e instanceof ProfileError) throw e;
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "products.queue" });
    throw new Error("File de revue indisponible pour le moment.");
  }
}

/** Dossier de revue complet (detail) — null si inconnu ou déjà tranché. */
export async function getReviewItemById(productId: string) {
  try {
    await requireStaffId();
    return await fetchReviewItem({ isStaff: true, productId });
  } catch (e) {
    if (e instanceof ProfileError) {
      // NOT_FOUND = 404 honnête ; FORBIDDEN remonte (gate staff).
      if (e.code === "NOT_FOUND") return null;
      throw e;
    }
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "products.reviewItem" });
    throw new Error("Dossier indisponible pour le moment.");
  }
}

/**
 * Dossier tranché ou inexistant ? (page review) : `true` = la fiche existe
 * mais n'est plus pending (→ redirect file, pas de 404 brut au reload
 * post-verdict) ; `false` = vraiment inconnue (→ 404 honnête).
 */
export async function isProductDecided(productId: string): Promise<boolean> {
  try {
    await requireStaffId();
    const row = await fetchProductAdminStatus({ isStaff: true, productId });
    return row !== null && row.status !== "pending";
  } catch {
    return false;
  }
}

export async function getAdminProductsList(input: {
  q?: string;
  status?: "all" | "draft" | "pending" | "published" | "rejected";
  cursor?: string | null;
}) {
  try {
    await requireStaffId();
    let cursor: { createdAt: Date; id: string } | null = null;
    if (input.cursor) {
      try {
        const parsed: unknown = JSON.parse(
          Buffer.from(input.cursor, "base64url").toString("utf-8"),
        );
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          typeof (parsed as { createdAt?: unknown }).createdAt === "string" &&
          typeof (parsed as { id?: unknown }).id === "string"
        ) {
          cursor = {
            createdAt: new Date((parsed as { createdAt: string }).createdAt),
            id: (parsed as { id: string }).id,
          };
        }
      } catch {
        cursor = null;
      }
    }
    const { items, nextCursor } = await fetchAdminProducts({
      isStaff: true,
      q: input.q,
      status: input.status,
      cursor,
    });
    return {
      items,
      nextCursor: nextCursor
        ? Buffer.from(
            JSON.stringify({ createdAt: nextCursor.createdAt.toISOString(), id: nextCursor.id }),
          ).toString("base64url")
        : null,
    };
  } catch {
    return { items: [], nextCursor: null };
  }
}
