ALTER TABLE "user_service_usage" DROP CONSTRAINT "user_service_usage_user_id_service_sub_service_month_year_unique";--> statement-breakpoint
ALTER TABLE "user_service_usage" ALTER COLUMN "usage" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "user_service_usage" ALTER COLUMN "unit_cost" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "user_service_usage" ALTER COLUMN "total_cost" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "user_service_usage" ADD CONSTRAINT "user_service_usage_user_id_service_sub_service_unit_unit_cost_month_year_unique" UNIQUE("user_id","service","sub_service","unit","unit_cost","month_year");