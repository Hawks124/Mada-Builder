CREATE TABLE "product_builds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"version_code" integer,
	"version_name" text,
	"package" text,
	"min_sdk" integer,
	"target_sdk" integer,
	"permissions" text[] DEFAULT '{}' NOT NULL,
	"cert_sha256" text,
	"cert_sha1" text,
	"sig_scheme" text,
	"sha256_file" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"r2_key" text NOT NULL,
	"whatsnew" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_builds" ADD CONSTRAINT "product_builds_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_builds_product_version_uidx" ON "product_builds" USING btree ("product_id","version_code");--> statement-breakpoint
CREATE INDEX "product_builds_product_created_idx" ON "product_builds" USING btree ("product_id","created_at");