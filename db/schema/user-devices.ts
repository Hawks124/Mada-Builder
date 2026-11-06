import { v7 as uuidv7 } from "uuid";
import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Terminaux FCM (contrat mobile, migration 0065 — miroir du lot infra
 * push de la squad mobile, migrations `20261030000001`+ arbitragées) :
 * association user ↔ tokens de notification push (FCM HTTP v1).
 *
 * Sécurité (0065, durcissement adopté des deux squads) :
 * - RLS enabled ; INSERT à `user_id IS NULL OR user_id = auth.uid()`
 *   (device anonyme au splashscreen, device rattachée à son compte) ;
 * - SELECT/DELETE own-only pour authenticated — un utilisateur ne
 *   lit jamais le token d'autrui (secrets de transport) ;
 * - UPDATE (anon + authenticated) : fin du `USING (true)` — cibler
 *   autre chose que SES lignes ou les lignes anonymes est mort, et le
 *   CHECK refuse possédé → NULL (l'attaque « neutraliser les devices
 *   d'un autre maker » meurt aux deux étages) ;
 * - `anon` n'a NI SELECT de table ni DELETE (grants 0065) ; son
 *   SELECT est scoped colonnes (id, user_id), strictement pour
 *   l'évaluation des policies RLS — le token reste jamais lisible et
 *   sans policy SELECT pour anon, aucune row n'est lisible de toute
 *   façon (Postgres exige la SELECT-visibilité pour toute UPDATE :
 *   l'UPDATE anonyme directe est muette, le renouvelllement de token
 *   anonyme passe par une INSERT au relancement).
 *
 * Ré-association device anonyme → compte : par l'Edge Function
 * (`service_role`, hors RLS) — une UPDATE PostgREST directe ne peut
 * jamais atteindre une row anonyme, et il ne le POURRAIT PAS sans
 * exposer les tokens anonymes d'autrui (protection faite exprès).
 *
 * Tokens morts : l'EF `send-push` (côté mobile) bascule `is_active =
 * false` sur `UNREGISTERED/NOT_FOUND` ; les appareils anonymes
 * (user_id NULL, jamais dispatchés) sont purgés à 30 jours de
 * silence par le cron `purge-anon-devices` (0065).
 *
 * Contrat milestone : `fcm_dispatched_at` sur `notifications` est le
 * verrou d'idempotence du pipeline (l'Edge Function stamp après envoi
 * — cooldown_skipped et no_devices SONT des terminaisons définitives,
 * arbitrage mobile : aucune notification n'est retentée).
 */
export const userDevices = pgTable(
  "user_devices",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    fcmToken: text("fcm_token").notNull().unique("user_devices_fcm_token_key"),
    platform: text("platform").notNull(),
    deviceModel: text("device_model"),
    osVersion: text("os_version"),
    appVersion: text("app_version"),
    isActive: boolean("is_active").notNull().default(true),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check("user_devices_platform_check", sql`${t.platform} IN ('android', 'ios')`),
    index("idx_user_devices_lookup")
      .on(t.userId)
      .where(sql`is_active = true AND user_id IS NOT NULL`),
  ],
);

export type UserDevice = typeof userDevices.$inferSelect;
export type NewUserDevice = typeof userDevices.$inferInsert;
