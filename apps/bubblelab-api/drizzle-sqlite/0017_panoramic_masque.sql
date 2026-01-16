ALTER TABLE `user_credentials` ADD `is_browser_session` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `user_credentials` ADD `browserbase_context_id` text;--> statement-breakpoint
ALTER TABLE `user_credentials` ADD `browserbase_cookies` text;--> statement-breakpoint
ALTER TABLE `user_credentials` ADD `browserbase_session_data` text;