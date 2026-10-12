CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(255) NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"mime_type" varchar(255) NOT NULL,
	"size" bigint NOT NULL,
	"s3_key" varchar(512) NOT NULL UNIQUE,
	"folder_id" uuid,
	"owner_id" uuid NOT NULL,
	"is_trashed" boolean DEFAULT false NOT NULL,
	"trashed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(255) NOT NULL,
	"parent_id" uuid,
	"owner_id" uuid NOT NULL,
	"path" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"is_trashed" boolean DEFAULT false NOT NULL,
	"trashed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"token" varchar(255) NOT NULL UNIQUE,
	"resource_type" varchar(255) NOT NULL,
	"resource_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"permission" varchar(255) DEFAULT 'download' NOT NULL,
	"expires_at" timestamp with time zone,
	"access_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255),
	"email" varchar(255) NOT NULL,
	"password" varchar(255),
	"role" varchar(2) DEFAULT '2' NOT NULL,
	"provider" varchar(255) DEFAULT 'email' NOT NULL,
	"provider_token" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"image" varchar(255),
	"storage_used" bigint DEFAULT 0 NOT NULL,
	"storage_limit" bigint DEFAULT 1073741824 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "idx_files_owner_folder" ON "files" ("owner_id","folder_id","is_trashed");--> statement-breakpoint
CREATE INDEX "idx_files_owner_trashed_date" ON "files" ("owner_id","is_trashed","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_files_owner_trashed_name" ON "files" ("owner_id","is_trashed","name");--> statement-breakpoint
CREATE INDEX "idx_folders_owner_parent" ON "folders" ("owner_id","parent_id","is_trashed");--> statement-breakpoint
CREATE INDEX "idx_folders_owner_trashed" ON "folders" ("owner_id","is_trashed");--> statement-breakpoint
CREATE INDEX "idx_folders_path" ON "folders" USING gin ("path");--> statement-breakpoint
CREATE INDEX "idx_shares_owner" ON "share_links" ("owner_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_shares_resource" ON "share_links" ("resource_id");--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_folder_id_folders_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_folders_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "folders"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE;