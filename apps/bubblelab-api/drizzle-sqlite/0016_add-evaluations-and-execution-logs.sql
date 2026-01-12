CREATE TABLE `bubble_flow_evaluations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`execution_id` integer NOT NULL,
	`bubble_flow_id` integer NOT NULL,
	`working` integer NOT NULL,
	`issue_type` text,
	`summary` text NOT NULL,
	`rating` integer NOT NULL,
	`model_used` text NOT NULL,
	`evaluated_at` integer NOT NULL,
	FOREIGN KEY (`execution_id`) REFERENCES `bubble_flow_executions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bubble_flow_id`) REFERENCES `bubble_flows`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `bubble_flow_executions` ADD `execution_logs` text;