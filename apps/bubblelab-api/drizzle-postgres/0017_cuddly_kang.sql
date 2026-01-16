ALTER TABLE "user_credentials" ADD COLUMN "is_browser_session" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user_credentials" ADD COLUMN "browserbase_context_id" text;--> statement-breakpoint
ALTER TABLE "user_credentials" ADD COLUMN "browserbase_cookies" text;--> statement-breakpoint
ALTER TABLE "user_credentials" ADD COLUMN "browserbase_session_data" jsonb;