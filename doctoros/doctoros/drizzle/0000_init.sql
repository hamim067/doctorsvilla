CREATE TYPE "public"."booking_source" AS ENUM('ONLINE', 'WALK_IN');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('WAITING', 'IN_PROGRESS', 'DONE', 'ABSENT', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."follow_up_status" AS ENUM('PENDING', 'REMINDED', 'BOOKED', 'MISSED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('DOCTOR', 'ASSISTANT', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."visit_type" AS ENUM('NEW', 'FOLLOW_UP');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"chamber_id" text NOT NULL,
	"doctor_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"date" text NOT NULL,
	"serial_no" integer NOT NULL,
	"status" "booking_status" DEFAULT 'WAITING' NOT NULL,
	"source" "booking_source" NOT NULL,
	"type" "visit_type" DEFAULT 'NEW' NOT NULL,
	"called_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chambers" (
	"id" text PRIMARY KEY NOT NULL,
	"doctor_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"fee_new" integer NOT NULL,
	"fee_follow_up" integer NOT NULL,
	"avg_minutes" integer DEFAULT 10 NOT NULL,
	"daily_limit" integer DEFAULT 30 NOT NULL,
	"online_share_pct" integer DEFAULT 60 NOT NULL,
	"tv_token" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chambers_tv_token_unique" UNIQUE("tv_token")
);
--> statement-breakpoint
CREATE TABLE "doctors" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"degrees" text NOT NULL,
	"specialty" text NOT NULL,
	"bmdc_no" text NOT NULL,
	"bmdc_verified" boolean DEFAULT false NOT NULL,
	"bio" text,
	"experience_years" integer,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "doctors_slug_unique" UNIQUE("slug"),
	CONSTRAINT "doctors_owner_id_unique" UNIQUE("owner_id")
);
--> statement-breakpoint
CREATE TABLE "follow_ups" (
	"id" text PRIMARY KEY NOT NULL,
	"doctor_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"visit_id" text NOT NULL,
	"due_date" text NOT NULL,
	"status" "follow_up_status" DEFAULT 'PENDING' NOT NULL,
	"reminded_at" timestamp with time zone,
	"booking_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follow_ups_visit_id_unique" UNIQUE("visit_id"),
	CONSTRAINT "follow_ups_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" text PRIMARY KEY NOT NULL,
	"chamber_id" text NOT NULL,
	"date" text NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "message_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"doctor_id" text,
	"to" text NOT NULL,
	"channel" text NOT NULL,
	"purpose" text NOT NULL,
	"body" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patient_accounts_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" text PRIMARY KEY NOT NULL,
	"number" serial NOT NULL,
	"account_id" text NOT NULL,
	"name" text NOT NULL,
	"gender" text,
	"birth_year" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patients_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"chamber_id" text NOT NULL,
	"weekday" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"doctor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text,
	"doctor_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"complaint" text,
	"diagnosis" text,
	"medicines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"advice" text,
	"follow_up_date" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visits_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_chamber_id_chambers_id_fk" FOREIGN KEY ("chamber_id") REFERENCES "public"."chambers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chambers" ADD CONSTRAINT "chambers_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_chamber_id_chambers_id_fk" FOREIGN KEY ("chamber_id") REFERENCES "public"."chambers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_account_id_patient_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."patient_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_chamber_id_chambers_id_fk" FOREIGN KEY ("chamber_id") REFERENCES "public"."chambers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_chamber_date_serial" ON "bookings" USING btree ("chamber_id","date","serial_no");--> statement-breakpoint
CREATE INDEX "bookings_chamber_date_status" ON "bookings" USING btree ("chamber_id","date","status");--> statement-breakpoint
CREATE INDEX "bookings_code" ON "bookings" USING btree ("code");--> statement-breakpoint
CREATE INDEX "bookings_patient" ON "bookings" USING btree ("patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chambers_doctor_code" ON "chambers" USING btree ("doctor_id","code");--> statement-breakpoint
CREATE INDEX "follow_ups_due_status" ON "follow_ups" USING btree ("due_date","status");--> statement-breakpoint
CREATE INDEX "follow_ups_doctor_status" ON "follow_ups" USING btree ("doctor_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "holidays_chamber_date" ON "holidays" USING btree ("chamber_id","date");--> statement-breakpoint
CREATE INDEX "message_logs_doctor_created" ON "message_logs" USING btree ("doctor_id","created_at");--> statement-breakpoint
CREATE INDEX "patients_name" ON "patients" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "schedules_chamber_weekday" ON "schedules" USING btree ("chamber_id","weekday");