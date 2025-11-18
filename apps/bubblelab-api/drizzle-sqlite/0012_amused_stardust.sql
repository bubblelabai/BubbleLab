CREATE TABLE `user_service_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`service` text NOT NULL,
	`sub_service` text,
	`month_year` text NOT NULL,
	`unit` text NOT NULL,
	`usage` integer DEFAULT 0 NOT NULL,
	`unit_cost` integer NOT NULL,
	`total_cost` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`clerk_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_service_usage_user_id_service_sub_service_month_year_unique` ON `user_service_usage` (`user_id`,`service`,`sub_service`,`month_year`);--> statement-breakpoint
DROP TABLE `user_model_usage`;