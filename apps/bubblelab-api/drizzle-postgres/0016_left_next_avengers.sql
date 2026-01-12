CREATE TABLE "bubble_flow_evaluations" (
	"id" serial PRIMARY KEY NOT NULL,
	"execution_id" integer NOT NULL,
	"bubble_flow_id" integer NOT NULL,
	"working" boolean NOT NULL,
	"issue" text,
	"rating" integer NOT NULL,
	"execution_logs" jsonb,
	"model_used" text NOT NULL,
	"evaluated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bubble_flow_evaluations" ADD CONSTRAINT "bubble_flow_evaluations_execution_id_bubble_flow_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."bubble_flow_executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bubble_flow_evaluations" ADD CONSTRAINT "bubble_flow_evaluations_bubble_flow_id_bubble_flows_id_fk" FOREIGN KEY ("bubble_flow_id") REFERENCES "public"."bubble_flows"("id") ON DELETE cascade ON UPDATE no action;