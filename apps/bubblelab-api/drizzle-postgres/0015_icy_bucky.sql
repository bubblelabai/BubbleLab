ALTER TABLE "bubble_flows" ALTER COLUMN "code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bubble_flows" ADD COLUMN "generation_error" text;