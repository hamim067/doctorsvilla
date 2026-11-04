CREATE TABLE "vitals" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"doctor_id" text,
	"source" text NOT NULL,
	"date" text NOT NULL,
	"systolic" integer,
	"diastolic" integer,
	"pulse" integer,
	"sugar_x10" integer,
	"sugar_when" text,
	"weight_x10" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "doctors" ADD COLUMN "assistant_rx_access" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vitals" ADD CONSTRAINT "vitals_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vitals" ADD CONSTRAINT "vitals_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vitals_patient_date" ON "vitals" USING btree ("patient_id","date");