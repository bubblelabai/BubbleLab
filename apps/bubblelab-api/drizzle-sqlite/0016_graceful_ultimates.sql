CREATE TABLE `bubble_flow_evaluations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`execution_id` integer NOT NULL,
	`bubble_flow_id` integer NOT NULL,
	`working` integer NOT NULL,
	`issue` text,
	`rating` integer NOT NULL,
	`execution_logs` text,
	`model_used` text NOT NULL,
	`evaluated_at` integer NOT NULL,
	FOREIGN KEY (`execution_id`) REFERENCES `bubble_flow_executions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bubble_flow_id`) REFERENCES `bubble_flows`(`id`) ON UPDATE no action ON DELETE cascade
);
