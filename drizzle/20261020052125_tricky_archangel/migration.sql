ALTER TABLE "users" RENAME COLUMN "image" TO "picture";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "provider_id" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "provider_token" SET DATA TYPE text USING "provider_token"::text;