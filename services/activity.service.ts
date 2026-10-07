import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { adminActions } from "@/db/schema";
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
    product_published: (a, t) => `${a} a publié ${t}`,
    product_rejected: (a, t, n) => `${a} a rejeté ${t}${n ? ` — ${n}` : ""}`,
    product_removed: (a, t, n) => `${a} a retiré ${t}${n ? ` — ${n}` : ""}`,
    product_featured: (a, t) => `${a} a épinglé ${t} (produit du jour)`,
    review_removed: (a, t, n) => `${a} a retiré un avis sur ${t}${n ? ` — ${n}` : ""}`,
    comment_removed: (a, t, n) => `${a} a retiré un commentaire sur ${t}${n ? ` — ${n}` : ""}`,
  };

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
  const [prodTargets, userTargets] = await Promise.all([
    targetIds.length > 0
      ? db
          .select({
            id: products.id,
            name: products.name,
            slug: products.slug,
            iconUrl: products.iconUrl,
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
  ]);
  const prodById = new Map(prodTargets.map((p) => [p.id, p]));
  const userById = new Map(userTargets.map((u) => [u.id, u]));
  const makerById = new Map<string, { displayName: string; avatarUrl: string | null }>();
  const subMakerIds = [...new Set(submissions.map((s) => s.makerId))];
  if (subMakerIds.length > 0) {
    const makers = await db
      .select({ id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl })
      .from(users)
      .where(inArray(users.id, subMakerIds));
    for (const m of makers) makerById.set(m.id, m);
  }

  type Raw = {
    at: Date;
    item: ActivityItem;
  };
  const raws: Raw[] = [];
  for (const a of audits) {
    const actor = a.actorName ?? "Ancien admin";
    const prod = prodById.get(a.targetId);
    const user = userById.get(a.targetId);
    const target = prod
      ? { name: prod.name, href: `/products/${prod.slug}` }
      : user
        ? { name: user.displayName, href: `/makers/${user.username}` }
        : { name: "élément supprimé", href: "/admin" };
    const text = (ACTION_TEXT[a.action] ?? ((x: string, y: string) => `${x} → ${y}`))(
      actor,
      target.name,
      a.note,
    );
    const danger =
      a.action === "ban" || a.action === "product_rejected" || a.action === "product_removed";
    raws.push({
      at: a.createdAt,
      item: {
        id: `audit-${a.id}`,
        text,
        href: target.href,
        time: timeAgoFr(a.createdAt),
        tone: danger ? "danger" : "neutral",
        subject: prod
          ? {
              type: "product",
              productId: prod.id,
              initials: appInitialsFor(prod.name),
              iconGradient: appGradientFor(prod.id),
              iconUrl: prod.iconUrl ?? undefined,
            }
          : user?.avatarUrl
            ? { type: "users", avatars: [user.avatarUrl], extra: 0 }
            : { type: "users", avatars: [], extra: 0 },
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
