CREATE TABLE "doctor_sites" (
	"doctor_id" text PRIMARY KEY NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"content" jsonb NOT NULL,
	"photo" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "doctors" ADD COLUMN "plan" text DEFAULT 'FREE' NOT NULL;--> statement-breakpoint
ALTER TABLE "doctors" ADD COLUMN "premium_until" text;--> statement-breakpoint
ALTER TABLE "doctor_sites" ADD CONSTRAINT "doctor_sites_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;