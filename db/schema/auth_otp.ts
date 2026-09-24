import { v7 as uuidv7 } from "uuid";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Codes OTP email custom (Resend) — pont vers Supabase Auth.
 *
 * Principe : NOUS générons le code 6 chiffres (template 100 % custom,
 * immunisé au prefetch Safe Links) ; Supabase RESTE la seule autorité de
 * session via `generateLink(magiclink|signup)` dont l'`action_link` est
 * stockée ici puis rejouée après vérification du code. Aucun fork d'auth.
 *
 * Sécurité (§16) : code en clair JAMAIS persisté ni loggé (SHA-256 seul),
 * comparaison timing-safe, un seul code actif par email (les précédents
 * sont supprimés à chaque demande), expiry 10 min, burn après 5 tentatives,
 * delete-on-use, throttle 60 s/email basé sur `created_at` (pas de Redis
 * requis — voir docs/auth.md). Cleanup des expirés via cron V1.5.
 */
export const authOtp = pgTable(
  "auth_otp",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    // Email normalisé lowercase (comparaisons exactes, pas de citext —
    // l'extension n'est pas garantie sur tous les providers).
    email: text("email").notNull(),
    // SHA-256 hex du code 6 chiffres. Irréversible, jamais le code clair.
    codeHash: text("code_hash").notNull(),
    // Lien Supabase généré côté serveur (service_role) rejoué au succès.
    // NULL pour les emails inconnus (création paresseuse : pas de compte
    // avant validation — le lien naît au verify, jamais à la demande).
    // Single-use via used_at + suppression immédiate après vérification.
    actionLink: text("action_link"),
    // Hash Supabase (properties.hashed_token) — échangé SERVER-SIDE via
    // verifyOtp (jamais de navigation navigateur vers Supabase : la classe
    // entière des bugs redirect/fragment/allowlist disparaît).
    // NULL tant qu'aucun lien n'a été généré (email inconnu à la demande).
    tokenHash: text("token_hash"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("auth_otp_email_created_idx").on(t.email, t.createdAt)],
);

export type AuthOtp = typeof authOtp.$inferSelect;
export type NewAuthOtp = typeof authOtp.$inferInsert;
