CREATE TABLE "doctor_assets" (
	"doctor_id" text NOT NULL,
	"kind" text NOT NULL,
	"data" text NOT NULL,
	"width" integer,
	"height" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "doctor_assets" ADD CONSTRAINT "doctor_assets_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "doctor_assets_doctor_kind" ON "doctor_assets" USING btree ("doctor_id","kind");