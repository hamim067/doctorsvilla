ALTER TABLE "bookings" ADD COLUMN "fee_waived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "allergies" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "conditions" text;