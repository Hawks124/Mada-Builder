import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { adminActions, productBuilds } from "@/db/schema";
import { products } from "@/db/schema";
import { users } from "@/db/schema";
import { appGradientFor, appInitialsFor } from "@/services/products.service";
import type { ActivityItem } from "@/components/admin/admin-mock";

/**
 * Activité récente admin (Lot 2 — FINI les mocks) : audit de modération
 * + soumissions + inscriptions, triés par date. Que du réel : pas
 * d'événements "palier de votes" ni de "sync" (aucune infra d'événements
 * — jamais de faux événements). Vide honnête si rien.
 */

export function timeAgoFr(at: Date | string): string {
  const date = typeof at === "string" ? new Date(at) : at;
  const s = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "hier";
  if (d < 7) return `il y a ${d} j`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

const ACTION_TEXT: Record<string, (actor: string, target: string, note: string | null) => string> =
  {
    ban: (a, t, n) => `${a} a suspendu ${t}${n ? ` — ${n}` : ""}`,
    unban: (a, t) => `${a} a réintégré ${t}`,
    promote: (a, t) => `${a} a nommé ${t} modérateur`,
    demote: (a, t) => `${a} a retiré ${t} de la modération`,
    appeal_upheld: (a, t) => `${a} a maintenu la sanction de ${t}`,
    appeal_overturned: (a, t) => `${a} a levé la sanction de ${t}`,
    // « a publié » INTERDIT ici : l'acteur est un modérateur, pas le maker
    // (géré en spécial ci-dessous : « X (modération) a approuvé Y de Z »).
    product_featured: (a, t) => `${a} a épinglé ${t} (produit du jour)`,
    product_nudged: (a, t, n) => `${a} a envoyé un rappel pour ${t}${n ? ` — ${n}` : ""}`,
    review_removed: (a, t, n) => `${a} a retiré un avis sur ${t}${n ? ` — ${n}` : ""}`,
    comment_removed: (a, t, n) => `${a} a retiré un commentaire sur ${t}${n ? ` — ${n}` : ""}`,
  };

/**
 * Notes d'audit « Nom : motif » → { snapshot, detail }. Les écritures
 * préfixent le nom du produit (snapshot anti-suppression) + le motif après
 * « : ». `product_published` n'a que le nom (snapshot pur).
 */
function splitSnapshotNote(note: string | null): {
  snapshot: string | null;
  detail: string | null;
} {
  if (!note) return { snapshot: null, detail: null };
  const i = note.indexOf(" : ");
  if (i < 0) return { snapshot: note, detail: null };
  return { snapshot: note.slice(0, i), detail: note.slice(i + 3) };
}

export async function getRecentActivity(limit = 10): Promise<ActivityItem[]> {
  const [audits, submissions, newcomers] = await Promise.all([
    db
      .select({
        id: adminActions.id,
        action: adminActions.action,
        targetId: adminActions.targetId,
        note: adminActions.note,
        createdAt: adminActions.createdAt,
        actorName: users.displayName,
      })
      .from(adminActions)
      .leftJoin(users, eq(adminActions.actorId, users.id))
      .orderBy(desc(adminActions.createdAt))
      .limit(limit),
    db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        makerId: products.makerId,
        iconUrl: products.iconUrl,
        createdAt: products.createdAt,
      })
      .from(products)
      .where(and(eq(products.status, "pending"), isNull(products.deletedAt)))
      .orderBy(desc(products.createdAt))
      .limit(limit),
    db
      .select({
        id: users.id,
        displayName: users.displayName,
        username: users.username,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(isNull(users.deletedAt))
      .orderBy(desc(users.createdAt))
      .limit(limit),
  ]);

  // Noms + visuels des cibles d'audit (produits + makers, 2 requêtes
  // groupées) : logo produit et avatar maker réels, jamais d'initiales
  // quand l'image existe.
  const targetIds = [...new Set(audits.map((a) => a.targetId))];
  const [prodTargets, userTargets, buildTargets] = await Promise.all([
    targetIds.length > 0
      ? db
          .select({
            id: products.id,
            name: products.name,
            slug: products.slug,
            iconUrl: products.iconUrl,
            status: products.status,
            makerId: products.makerId,
          })
          .from(products)
          .where(inArray(products.id, targetIds))
      : [],
    targetIds.length > 0
      ? db
          .select({
            id: users.id,
            displayName: users.displayName,
            username: users.username,
            avatarUrl: users.avatarUrl,
          })
          .from(users)
          .where(inArray(users.id, targetIds))
      : [],
    // Audits binaires (build_approved/rejected) : targetId = build, jamais
    // un produit/user (c'était la source des « → élément supprimé »).
    targetIds.length > 0
      ? db
          .select({
            id: productBuilds.id,
            productId: productBuilds.productId,
            versionCode: productBuilds.versionCode,
            versionName: productBuilds.versionName,
          })
          .from(productBuilds)
          .where(inArray(productBuilds.id, targetIds))
      : [],
  ]);
  const prodById = new Map(prodTargets.map((p) => [p.id, p]));
  const userById = new Map(userTargets.map((u) => [u.id, u]));
  const buildById = new Map(buildTargets.map((b) => [b.id, b]));
  const makerById = new Map<string, { displayName: string; avatarUrl: string | null }>();
  // Makers des soumissions + des fiches auditées (attribution « de X » sur
  // les approbations — l'admin n'est jamais présenté comme maker).
  const subMakerIds = [...new Set(submissions.map((s) => s.makerId))];
  const prodMakerIds = [...new Set([...prodById.values()].map((p) => p.makerId))];
  const makerIds = [...new Set([...subMakerIds, ...prodMakerIds])];
  if (makerIds.length > 0) {
    const makers = await db
      .select({ id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl })
      .from(users)
      .where(inArray(users.id, makerIds));
    for (const m of makers) makerById.set(m.id, m);
  }

  type Raw = {
    at: Date;
    item: ActivityItem;
  };
  const raws: Raw[] = [];
  for (const a of audits) {
    const actor = a.actorName ?? "Ancien admin";
    // L'acteur est staff : jamais présenté comme auteur du produit.
    const staff = `${actor} (modération)`;
    const prod = prodById.get(a.targetId);
    const user = userById.get(a.targetId);
    const build = buildById.get(a.targetId);
    const buildProd = build ? prodById.get(build.productId) : undefined;
    const { snapshot, detail } = splitSnapshotNote(a.note);
    // Lien fiche selon le statut (D6) : pending → cockpit, rejected → file
    // des rejetés, published → fiche publique. Cible disparue → /admin
    // (jamais de 404, jamais « élément supprimé » nu).
    const prodHref = (p: typeof prod): string =>
      !p
        ? "/admin"
        : p.status === "published"
          ? `/products/${p.slug}`
          : p.status === "pending"
            ? `/admin/review/${p.id}`
            : p.status === "rejected"
              ? "/admin/rejected"
              : "/admin";
    const prodSubject = (p: NonNullable<typeof prod>): ActivityItem["subject"] => ({
      type: "product",
      productId: p.id,
      initials: appInitialsFor(p.name),
      iconGradient: appGradientFor(p.id),
      iconUrl: p.iconUrl ?? undefined,
    });
    const missingSubject: ActivityItem["subject"] = { type: "users", avatars: [], extra: 0 };
    let text: string;
    let href: string;
    let subject: ActivityItem["subject"];
    if (build) {
      // Audit binaire : « APK vX (N) de Produit », lien cockpit (la revue
      // gère les builds décidés). Produit supprimé entre-temps → snapshot.
      const label = `v${build.versionName ?? "?"} (${build.versionCode ?? "?"})`;
      const pname = buildProd?.name ?? "produit supprimé";
      text =
        a.action === "build_rejected"
          ? `${staff} a rejeté l'APK ${label} de ${pname}${detail ? ` — ${detail}` : ""}`
          : `${staff} a approuvé l'APK ${label} de ${pname}`;
      href = `/admin/review/${build.id}`;
      subject = buildProd ? prodSubject(buildProd) : missingSubject;
    } else if (a.action === "product_published") {
      const maker = prod ? makerById.get(prod.makerId) : undefined;
      text = prod
        ? `${staff} a approuvé ${prod.name}${maker ? ` de ${maker.displayName}` : ""}`
        : snapshot
          ? `${staff} a approuvé le produit « ${snapshot} »`
          : `${staff} a approuvé un produit (supprimé)`;
      href = prodHref(prod);
      subject = prod ? prodSubject(prod) : missingSubject;
    } else if (a.action === "product_rejected" || a.action === "product_removed") {
      // Note = « Nom : motif » : le motif seul (fini le nom dupliqué).
      const verb = a.action === "product_rejected" ? "rejeté" : "retiré le produit";
      text = prod
        ? `${staff} a ${verb} ${prod.name}${detail ? ` — ${detail}` : ""}`
        : snapshot
          ? `${staff} a ${verb} « ${snapshot} »${detail ? ` — ${detail}` : ""}`
          : `${staff} a ${verb} (supprimé)`;
      href = prodHref(prod);
      subject = prod ? prodSubject(prod) : missingSubject;
    } else if ((a.action === "review_removed" || a.action === "comment_removed") && !prod) {
      const kind = a.action === "review_removed" ? "un avis" : "un commentaire";
      text = `${staff} a retiré ${kind} (produit supprimé)${a.note ? ` — ${a.note}` : ""}`;
      href = "/admin";
      subject = missingSubject;
    } else {
      // Cas génériques (ban, featured, nudge, avis/commentaire sur fiche
      // existante) : libellé standard.
      const target = prod
        ? { name: prod.name, href: prodHref(prod) }
        : user
          ? { name: user.displayName, href: `/makers/${user.username}` }
          : { name: "élément supprimé", href: "/admin" };
      text = (ACTION_TEXT[a.action] ?? ((x: string, y: string) => `${x} → ${y}`))(
        actor,
        target.name,
        a.note,
      );
      href = target.href;
      subject = prod
        ? prodSubject(prod)
        : user?.avatarUrl
          ? { type: "users", avatars: [user.avatarUrl], extra: 0 }
          : missingSubject;
    }
    const danger =
      a.action === "ban" ||
      a.action === "product_rejected" ||
      a.action === "product_removed" ||
      a.action === "build_rejected";
    raws.push({
      at: a.createdAt,
      item: {
        id: `audit-${a.id}`,
        text,
        href,
        time: timeAgoFr(a.createdAt),
        tone: danger ? "danger" : "neutral",
        subject,
      },
    });
  }
  for (const s of submissions) {
    const maker = makerById.get(s.makerId);
    raws.push({
      at: s.createdAt,
      item: {
        id: `sub-${s.id}`,
        text: `${s.name} soumis par ${maker?.displayName ?? "Un maker"}`,
        href: `/admin/review`,
        time: timeAgoFr(s.createdAt),
        tone: "neutral" as const,
        subject: {
          type: "product",
          productId: s.id,
          initials: appInitialsFor(s.name),
          iconGradient: appGradientFor(s.id),
          iconUrl: s.iconUrl ?? undefined,
        },
      },
    });
  }
  for (const u of newcomers) {
    raws.push({
      at: u.createdAt,
      item: {
        id: `user-${u.id}`,
        text: `${u.displayName} a rejoint la plateforme`,
        href: `/makers/${u.username}`,
        time: timeAgoFr(u.createdAt),
        tone: "neutral" as const,
        subject: u.avatarUrl
          ? { type: "users", avatars: [u.avatarUrl], extra: 0 }
          : { type: "users", avatars: [], extra: 0 },
      },
    });
  }
  raws.sort((a, b) => b.at.getTime() - a.at.getTime());
  return raws.slice(0, limit).map((r) => r.item);
}
