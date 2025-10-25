ALTER TABLE `bubble_flow_executions` ADD `code` text;--> statement-breakpoint
ALTER TABLE `bubble_flows` ADD `cron` text;--> statement-breakpoint
ALTER TABLE `bubble_flows` ADD `cron_active` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `bubble_flows` ADD `default_inputs` text;