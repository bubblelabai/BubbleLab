PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bubble_flows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`prompt` text,
	`code` text,
	`original_code` text,
	`generation_error` text,
	`bubble_parameters` text,
	`metadata` text,
	`workflow` text,
	`event_type` text NOT NULL,
	`input_schema` text,
	`webhook_execution_count` integer DEFAULT 0 NOT NULL,
	`webhook_failure_count` integer DEFAULT 0 NOT NULL,
	`cron` text,
	`cron_active` integer DEFAULT false NOT NULL,
	`default_inputs` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`clerk_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_bubble_flows`("id", "user_id", "name", "description", "prompt", "code", "original_code", "generation_error", "bubble_parameters", "metadata", "workflow", "event_type", "input_schema", "webhook_execution_count", "webhook_failure_count", "cron", "cron_active", "default_inputs", "created_at", "updated_at") SELECT "id", "user_id", "name", "description", "prompt", "code", "original_code", "generation_error", "bubble_parameters", "metadata", "workflow", "event_type", "input_schema", "webhook_execution_count", "webhook_failure_count", "cron", "cron_active", "default_inputs", "created_at", "updated_at" FROM `bubble_flows`;--> statement-breakpoint
DROP TABLE `bubble_flows`;--> statement-breakpoint
ALTER TABLE `__new_bubble_flows` RENAME TO `bubble_flows`;--> statement-breakpoint
PRAGMA foreign_keys=ON;