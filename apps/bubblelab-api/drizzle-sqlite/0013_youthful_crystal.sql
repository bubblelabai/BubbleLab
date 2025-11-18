PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user_service_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`service` text NOT NULL,
	`sub_service` text,
	`month_year` text NOT NULL,
	`unit` text NOT NULL,
	`usage` real DEFAULT 0 NOT NULL,
	`unit_cost` real NOT NULL,
	`total_cost` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`clerk_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_user_service_usage`("id", "user_id", "service", "sub_service", "month_year", "unit", "usage", "unit_cost", "total_cost", "created_at", "updated_at") SELECT "id", "user_id", "service", "sub_service", "month_year", "unit", "usage", "unit_cost", "total_cost", "created_at", "updated_at" FROM `user_service_usage`;--> statement-breakpoint
DROP TABLE `user_service_usage`;--> statement-breakpoint
ALTER TABLE `__new_user_service_usage` RENAME TO `user_service_usage`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `user_service_usage_user_id_service_sub_service_unit_cost_unit_month_year_unique` ON `user_service_usage` (`user_id`,`service`,`sub_service`,`unit_cost`,`unit`,`month_year`);