CREATE TABLE `user_model_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`model_name` text NOT NULL,
	`month_year` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`clerk_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_model_usage_user_id_model_name_month_year_unique` ON `user_model_usage` (`user_id`,`model_name`,`month_year`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`clerk_id` text PRIMARY KEY NOT NULL,
	`first_name` text,
	`last_name` text,
	`email` text NOT NULL,
	`app_type` text DEFAULT 'nodex' NOT NULL,
	`monthly_usage_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("clerk_id", "first_name", "last_name", "email", "app_type", "monthly_usage_count", "created_at", "updated_at") SELECT "clerk_id", "first_name", "last_name", "email", "app_type", "monthly_usage_count", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_bubble_flows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`prompt` text,
	`code` text NOT NULL,
	`original_code` text,
	`bubble_parameters` text,
	`metadata` text,
	`event_type` text NOT NULL,
	`input_schema` text,
	`webhook_execution_count` integer DEFAULT 0 NOT NULL,
	`webhook_failure_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`clerk_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_bubble_flows`("id", "user_id", "name", "description", "prompt", "code", "original_code", "bubble_parameters", "metadata", "event_type", "input_schema", "webhook_execution_count", "webhook_failure_count", "created_at", "updated_at") SELECT "id", "user_id", "name", "description", "prompt", "code", "original_code", "bubble_parameters", "metadata", "event_type", "input_schema", "webhook_execution_count", "webhook_failure_count", "created_at", "updated_at" FROM `bubble_flows`;--> statement-breakpoint
DROP TABLE `bubble_flows`;--> statement-breakpoint
ALTER TABLE `__new_bubble_flows` RENAME TO `bubble_flows`;--> statement-breakpoint
CREATE TABLE `__new_user_credentials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`credential_type` text NOT NULL,
	`encrypted_value` text,
	`name` text,
	`metadata` text,
	`oauth_access_token` text,
	`oauth_refresh_token` text,
	`oauth_expires_at` integer,
	`oauth_scopes` text,
	`oauth_token_type` text DEFAULT 'Bearer',
	`oauth_provider` text,
	`is_oauth` integer DEFAULT false,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`clerk_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_user_credentials`("id", "user_id", "credential_type", "encrypted_value", "name", "metadata", "oauth_access_token", "oauth_refresh_token", "oauth_expires_at", "oauth_scopes", "oauth_token_type", "oauth_provider", "is_oauth", "created_at", "updated_at") SELECT "id", "user_id", "credential_type", "encrypted_value", "name", "metadata", "oauth_access_token", "oauth_refresh_token", "oauth_expires_at", "oauth_scopes", "oauth_token_type", "oauth_provider", "is_oauth", "created_at", "updated_at" FROM `user_credentials`;--> statement-breakpoint
DROP TABLE `user_credentials`;--> statement-breakpoint
ALTER TABLE `__new_user_credentials` RENAME TO `user_credentials`;--> statement-breakpoint
CREATE TABLE `__new_webhooks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`path` text NOT NULL,
	`bubble_flow_id` integer NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`clerk_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bubble_flow_id`) REFERENCES `bubble_flows`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_webhooks`("id", "user_id", "path", "bubble_flow_id", "is_active", "created_at", "updated_at") SELECT "id", "user_id", "path", "bubble_flow_id", "is_active", "created_at", "updated_at" FROM `webhooks`;--> statement-breakpoint
DROP TABLE `webhooks`;--> statement-breakpoint
ALTER TABLE `__new_webhooks` RENAME TO `webhooks`;--> statement-breakpoint
CREATE UNIQUE INDEX `webhooks_user_id_path_unique` ON `webhooks` (`user_id`,`path`);