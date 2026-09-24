import { v7 as uuidv7 } from "uuid";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Rôles — `user` par défaut, `moderateur` (opérationnel : panel, ban,
 * appels — ZÉRO gestion de grades), `admin` (fondateur : + grades
 * user↔moderateur). Le grade `admin` est inaltérable via UI dans les
 * deux sens (SQL only) — voir docs/auth.md §2 (matrice).
 */
export const userRoleEnum = pgEnum("user_role", ["user", "moderateur", "admin"]);

/** Liens sociaux — clés fermées, URLs https validées Zod. */
export type SocialLinks = {
  github?: string;
  x?: string;
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  tiktok?: string;
  whatsapp?: string;
  website?: string;
};

export const users = pgTable("users", {
  // PRD §8 : UUIDv7 (triables dans le temps, non énumérables).
  // Généré côté app (package `uuid`) — indépendant de la version Postgres
  // (uuidv7() natif = PG18+, Supabase est en PG17). Le slug public reste
  // `username`, jamais l'id.
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),

  // Slug public immuable — choisi au signup, jamais modifié (SEO §7).
  // Règle partagée avec lib/utils slugifyName + liste réservée (docs/auth).
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),

  // Email de connexion — JAMAIS exposé en lecture publique (allowlist
  // stricte dans users.service, jamais de select * sur cette table).
  email: text("email").notNull().unique(),

  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  // Vocabulaire fermé config/occupations (users.occupation).
  occupation: text("occupation").notNull().default("maker"),
  websiteUrl: text("website_url"),
  socialLinks: jsonb("social_links").$type<SocialLinks>().notNull().default({}),
  country: text("country"),
  city: text("city"),

  // Fuseau IANA réel (capté navigateur : Intl…resolvedOptions().timeZone)
  // pour les emails à heure locale vraie. NULL = repli documenté
  // (audience) — jamais bloquant, jamais exposé en public.
  timeZone: text("time_zone"),

  // Fournisseurs liés (github/google/email) — synchronisé au login.
  // Source de vérité auth : Supabase identities ; ce miroir sert
  // l'affichage admin/settings sans appel Auth API par ligne.
  providers: text("providers").array().notNull().default([]),

  role: userRoleEnum("role").notNull().default("user"),

  // Onboarding /bienvenue vu et complété. Backfill à true pour les lignes
  // saines existantes (voir migration) ; la détection placeholder/nom-court
  // reste en filet (getMissingProfileFields) pour la data sale.
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),

  // Modération ban-only (réversible + appels illimités — jamais de
  // suppression user côté admin ; voir docs/adr).
  banReason: text("ban_reason"),
  bannedAt: timestamp("banned_at", { withTimezone: true }),
  appealsCount: integer("appeals_count").notNull().default(0),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  // Soft-delete — la suppression RGPD réelle efface la ligne (et cascade).
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
