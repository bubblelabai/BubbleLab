CREATE TABLE "user_service_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"service" text NOT NULL,
	"sub_service" text,
	"month_year" text NOT NULL,
	"unit" text NOT NULL,
	"usage" integer DEFAULT 0 NOT NULL,
	"unit_cost" integer NOT NULL,
	"total_cost" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_service_usage_user_id_service_sub_service_month_year_unique" UNIQUE("user_id","service","sub_service","month_year")
);
--> statement-breakpoint
DROP TABLE "user_model_usage" CASCADE;--> statement-breakpoint
ALTER TABLE "user_service_usage" ADD CONSTRAINT "user_service_usage_user_id_users_clerk_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("clerk_id") ON DELETE cascade ON UPDATE no action;