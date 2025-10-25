ALTER TABLE "bubble_flow_executions" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "bubble_flows" ADD COLUMN "cron" text;--> statement-breakpoint
ALTER TABLE "bubble_flows" ADD COLUMN "cron_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bubble_flows" ADD COLUMN "default_inputs" jsonb;