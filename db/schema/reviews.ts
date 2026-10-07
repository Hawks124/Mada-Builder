import { v7 as uuidv7 } from "uuid";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { products } from "./products";

/**
 * Avis (Lot avis/comments) : 1 par user/produit (`UNIQUE`), note 1-5 +
 * texte REQUIS (10-2000). Moyenne = SUM/COUNT (colonnes dénormalisées
 * `ratings_sum`/`ratings_count` sur products, jamais de flottant stocké).
 * Réponse maker : UNE seule, officielle (style éditorial, pas de thread).
 * Suppression auteur = soft (le contenu devient "supprimé"). RLS deny-all
 * (setup.sql) : tout passe par le service (service_role).
 */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    rating: smallint("rating").notNull(),
    body: text("body").notNull(),
    makerResponse: text("maker_response"),
    makerRespondedAt: timestamp("maker_responded_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("reviews_user_product_uidx").on(t.userId, t.productId),
    index("reviews_product_created_idx").on(t.productId, t.createdAt),
  ],
);

/**
 * Commentaires : thread 1 NIVEAU (reply → parent, jamais de reply de
 * reply — refusé serveur). Score dénormalisé (up/down). Suppression
 * auteur = soft. RLS deny-all : service seul.
 */
export const comments = pgTable(
  "comments",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    body: text("body").notNull(),
    score: integer("score").notNull().default(0),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("comments_product_created_idx").on(t.productId, t.createdAt),
    index("comments_parent_idx").on(t.parentId),
  ],
);

/** Votes commentaires : `UNIQUE(user,comment)`, +1/-1, toggle (pattern votes). */
export const commentVoteEnum = pgEnum("comment_vote_value", ["up", "down"]);

export const commentVotes = pgTable(
  "comment_votes",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    value: commentVoteEnum("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("comment_votes_user_comment_uidx").on(t.userId, t.commentId)],
);

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
export type ProductComment = typeof comments.$inferSelect;
export type CommentVote = typeof commentVotes.$inferSelect;
