PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_user_credentials`("id", "user_id", "credential_type", "encrypted_value", "name", "metadata", "created_at", "updated_at") SELECT "id", "user_id", "credential_type", "encrypted_value", "name", "metadata", "created_at", "updated_at" FROM `user_credentials`;--> statement-breakpoint
DROP TABLE `user_credentials`;--> statement-breakpoint
ALTER TABLE `__new_user_credentials` RENAME TO `user_credentials`;--> statement-breakpoint
PRAGMA foreign_keys=ON;