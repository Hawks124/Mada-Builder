ALTER TABLE "product_screenshots" ADD COLUMN "orientation" text DEFAULT 'landscape' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_screenshots" ADD COLUMN "width" integer;--> statement-breakpoint
ALTER TABLE "product_screenshots" ADD COLUMN "height" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "gallery_orientation" text DEFAULT 'landscape' NOT NULL;