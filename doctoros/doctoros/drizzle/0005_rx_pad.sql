ALTER TABLE "doctors" ADD COLUMN "rx_pad" jsonb;--> statement-breakpoint
ALTER TABLE "visits" ADD COLUMN "investigations" text;--> statement-breakpoint
ALTER TABLE "vitals" ADD COLUMN "temp_x10" integer;--> statement-breakpoint
ALTER TABLE "vitals" ADD COLUMN "spo2" integer;