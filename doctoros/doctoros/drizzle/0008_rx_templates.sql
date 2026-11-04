CREATE TABLE "rx_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"doctor_id" text NOT NULL,
	"name" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rx_templates" ADD CONSTRAINT "rx_templates_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rx_templates_doctor_name" ON "rx_templates" USING btree ("doctor_id","name");