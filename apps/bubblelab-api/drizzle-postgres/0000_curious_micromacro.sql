CREATE TABLE "bubble_flow_executions" (
	"id" serial PRIMARY KEY NOT NULL,
	"bubble_flow_id" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"result" jsonb,
	"status" text NOT NULL,
	"error" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "bubble_flows" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"code" text NOT NULL,
	"original_code" text,
	"bubble_parameters" jsonb,
	"event_type" text NOT NULL,
	"webhook_execution_count" integer DEFAULT 0 NOT NULL,
	"webhook_failure_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"credential_type" text NOT NULL,
	"encrypted_value" text NOT NULL,
	"name" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" serial PRIMARY KEY NOT NULL,
	"clerk_id" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"email" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"path" text NOT NULL,
	"bubble_flow_id" integer NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "webhooks_user_id_path_unique" UNIQUE("user_id","path")
);
--> statement-breakpoint
ALTER TABLE "bubble_flow_executions" ADD CONSTRAINT "bubble_flow_executions_bubble_flow_id_bubble_flows_id_fk" FOREIGN KEY ("bubble_flow_id") REFERENCES "public"."bubble_flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_bubble_flow_id_bubble_flows_id_fk" FOREIGN KEY ("bubble_flow_id") REFERENCES "public"."bubble_flows"("id") ON DELETE cascade ON UPDATE no action;