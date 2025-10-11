ALTER TABLE "user_credentials" ALTER COLUMN "encrypted_value" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_credentials" ADD COLUMN "oauth_access_token" text;--> statement-breakpoint
ALTER TABLE "user_credentials" ADD COLUMN "oauth_refresh_token" text;--> statement-breakpoint
ALTER TABLE "user_credentials" ADD COLUMN "oauth_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_credentials" ADD COLUMN "oauth_scopes" jsonb;--> statement-breakpoint
ALTER TABLE "user_credentials" ADD COLUMN "oauth_token_type" text DEFAULT 'Bearer';--> statement-breakpoint
ALTER TABLE "user_credentials" ADD COLUMN "oauth_provider" text;--> statement-breakpoint
ALTER TABLE "user_credentials" ADD COLUMN "is_oauth" boolean DEFAULT false;