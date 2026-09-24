CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"avatar_url" text,
	"bio" text,
	"occupation" text DEFAULT 'maker' NOT NULL,
	"website_url" text,
	"social_links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"country" text,
	"city" text,
	"providers" text[] DEFAULT '{}' NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"ban_reason" text,
	"banned_at" timestamp with time zone,
	"appeals_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
