CREATE TABLE `waitlisted_users` (
	`email` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`database` text NOT NULL,
	`other_database` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
