// DoctorOS — ডেটাবেস স্কিমা (PostgreSQL + Drizzle ORM)
// তারিখ-স্ট্রিং ("YYYY-MM-DD") সবসময় বাংলাদেশ সময় (Asia/Dhaka) অনুযায়ী।
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () => text("id").primaryKey().$defaultFn(() => createId());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const roleEnum = pgEnum("role", ["DOCTOR", "ASSISTANT", "ADMIN"]);
// WAITING অপেক্ষমাণ · IN_PROGRESS চলছে · DONE সম্পন্ন · ABSENT অনুপস্থিত · CANCELLED বাতিল
export const bookingStatusEnum = pgEnum("booking_status", ["WAITING", "IN_PROGRESS", "DONE", "ABSENT", "CANCELLED"]);
export const bookingSourceEnum = pgEnum("booking_source", ["ONLINE", "WALK_IN"]);
export const visitTypeEnum = pgEnum("visit_type", ["NEW", "FOLLOW_UP"]);
// PENDING তারিখ আসেনি · REMINDED রিমাইন্ডার গেছে · BOOKED সিরিয়াল নিয়েছেন · MISSED আসেননি
export const followUpStatusEnum = pgEnum("follow_up_status", ["PENDING", "REMINDED", "BOOKED", "MISSED", "CANCELLED"]);

/** লগইন করা স্টাফ: ডাক্তার নিজে বা তার অ্যাসিস্ট্যান্ট */
export const users = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  /** কোন ডাক্তারের অধীনে (ডাক্তার নিজে হলেও তার নিজের doctorId) */
  doctorId: text("doctor_id"),
  createdAt: createdAt(),
});

export const doctors = pgTable("doctors", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  degrees: text("degrees").notNull(),
  specialty: text("specialty").notNull(),
  bmdcNo: text("bmdc_no").notNull(),
  bmdcVerified: boolean("bmdc_verified").notNull().default(false),
  bio: text("bio"),
  experienceYears: integer("experience_years"),
  /** FREE | PREMIUM — Premium হলে প্রোফাইল লিংকে পুরো ওয়েবসাইট দেখায় */
  plan: text("plan").notNull().default("FREE"),
  /** Premium কোন তারিখ পর্যন্ত ("YYYY-MM-DD"); null = মেয়াদ নেই */
  premiumUntil: text("premium_until"),
  ownerId: text("owner_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
});

export const chambers = pgTable(
  "chambers",
  {
    id: id(),
    doctorId: text("doctor_id").notNull().references(() => doctors.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** সিরিয়াল কোডের শুরু, যেমন RAJ → RAJ-1102-07 */
    code: text("code").notNull(),
    address: text("address").notNull(),
    city: text("city").notNull(),
    feeNew: integer("fee_new").notNull(),
    feeFollowUp: integer("fee_follow_up").notNull(),
    /** প্রতি রোগী গড় সময় (মিনিট) — আজকের আসল গড় না পাওয়া পর্যন্ত এটা দিয়ে ETA */
    avgMinutes: integer("avg_minutes").notNull().default(10),
    dailyLimit: integer("daily_limit").notNull().default(30),
    /** কত % সিরিয়াল অনলাইনে দেওয়া যাবে; বাকিটা সরাসরি আসাদের জন্য */
    onlineSharePct: integer("online_share_pct").notNull().default(60),
    /** চেম্বারের টিভি ডিসপ্লের গোপন লিংক */
    tvToken: text("tv_token").notNull().unique().$defaultFn(() => createId()),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("chambers_doctor_code").on(t.doctorId, t.code)],
);

/** সাপ্তাহিক সময়সূচি — weekday: 0 = রবিবার … 6 = শনিবার */
export const schedules = pgTable(
  "schedules",
  {
    id: id(),
    chamberId: text("chamber_id").notNull().references(() => chambers.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    startTime: text("start_time").notNull(), // "18:00"
    endTime: text("end_time").notNull(), // "21:00"
  },
  (t) => [uniqueIndex("schedules_chamber_weekday").on(t.chamberId, t.weekday)],
);

export const holidays = pgTable(
  "holidays",
  {
    id: id(),
    chamberId: text("chamber_id").notNull().references(() => chambers.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    note: text("note"),
  },
  (t) => [uniqueIndex("holidays_chamber_date").on(t.chamberId, t.date)],
);

/** একটি মোবাইল নাম্বার = একটি অ্যাকাউন্ট; নিচে পরিবারের একাধিক রোগী */
export const patientAccounts = pgTable("patient_accounts", {
  id: id(),
  phone: text("phone").notNull().unique(),
  email: text("email"),
  createdAt: createdAt(),
});

export const patients = pgTable(
  "patients",
  {
    id: id(),
    /** দেখানো রোগী আইডি: P-10001 */
    number: serial("number").notNull().unique(),
    accountId: text("account_id").notNull().references(() => patientAccounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    gender: text("gender"),
    birthYear: integer("birth_year"),
    /** অ্যাকাউন্টধারীর সাথে সম্পর্ক: নিজে, মা, বাবা, স্ত্রী, ছেলে… */
    relation: text("relation"),
    createdAt: createdAt(),
  },
  (t) => [index("patients_name").on(t.name)],
);

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    /** RAJ-1102-07 — রোগীকে দেখানোর কোড; আসল অনন্যতা নিচের chamber+date+serial ইনডেক্সে */
    code: text("code").notNull(),
    chamberId: text("chamber_id").notNull().references(() => chambers.id, { onDelete: "cascade" }),
    doctorId: text("doctor_id").notNull().references(() => doctors.id, { onDelete: "cascade" }),
    patientId: text("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    serialNo: integer("serial_no").notNull(),
    status: bookingStatusEnum("status").notNull().default("WAITING"),
    source: bookingSourceEnum("source").notNull(),
    type: visitTypeEnum("type").notNull().default("NEW"),
    calledAt: timestamp("called_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    // একই চেম্বারে একই দিনে একই সিরিয়াল দুজন পাবে না
    uniqueIndex("bookings_chamber_date_serial").on(t.chamberId, t.date, t.serialNo),
    index("bookings_chamber_date_status").on(t.chamberId, t.date, t.status),
    index("bookings_code").on(t.code),
    index("bookings_patient").on(t.patientId),
  ],
);

/** প্রেসক্রিপশন */
export type Medicine = { name: string; dose: string; when: string; days: string };

export const visits = pgTable("visits", {
  id: id(),
  bookingId: text("booking_id").unique().references(() => bookings.id, { onDelete: "set null" }),
  doctorId: text("doctor_id").notNull().references(() => doctors.id, { onDelete: "cascade" }),
  patientId: text("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  complaint: text("complaint"),
  diagnosis: text("diagnosis"),
  medicines: jsonb("medicines").$type<Medicine[]>().notNull().default([]),
  advice: text("advice"),
  followUpDate: text("follow_up_date"),
  createdAt: createdAt(),
});

export const followUps = pgTable(
  "follow_ups",
  {
    id: id(),
    doctorId: text("doctor_id").notNull().references(() => doctors.id, { onDelete: "cascade" }),
    patientId: text("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
    visitId: text("visit_id").notNull().unique().references(() => visits.id, { onDelete: "cascade" }),
    dueDate: text("due_date").notNull(),
    status: followUpStatusEnum("status").notNull().default("PENDING"),
    remindedAt: timestamp("reminded_at", { withTimezone: true }),
    bookingId: text("booking_id").unique().references(() => bookings.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("follow_ups_due_status").on(t.dueDate, t.status), index("follow_ups_doctor_status").on(t.doctorId, t.status)],
);

/** রোগীর লগইনের এককালীন কোড (OTP) — কোডটা হ্যাশ করে রাখা হয় */
export const otpCodes = pgTable(
  "otp_codes",
  {
    id: id(),
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("otp_phone_created").on(t.phone, t.createdAt)],
);

/** পাঠানো সব মেসেজের হিসাব — এসএমএস খরচ গোনার জন্যও */
export const messageLogs = pgTable(
  "message_logs",
  {
    id: id(),
    doctorId: text("doctor_id"),
    to: text("to").notNull(),
    channel: text("channel").notNull(), // sms | whatsapp | push | email
    purpose: text("purpose").notNull(), // booking | followup | holiday
    body: text("body").notNull(),
    status: text("status").notNull(), // sent | failed | logged
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("message_logs_doctor_created").on(t.doctorId, t.createdAt)],
);

/** ডাক্তারের Premium ওয়েবসাইটের লেখা ও সেটিং — চেম্বার/সময়/ফি আসে chambers টেবিল থেকে */
export type SiteService = { title: string; desc: string; icon: string };
export type SiteFaq = { q: string; a: string };
export type SiteText = {
  name?: string; degrees?: string; designation: string; topNote: string;
  heroTitle: string; heroText: string; about: string; servicesTitle: string;
  services: SiteService[]; faqs: SiteFaq[]; emergency: string;
};
export type SiteSections = {
  topbar: boolean; stats: boolean; services: boolean; about: boolean;
  chambers: boolean; booking: boolean; faq: boolean; emergency: boolean;
};
export type SiteContent = {
  theme: "navy" | "green" | "plum";
  sections: SiteSections;
  stats: { experience: boolean; patients: boolean; chambers: boolean };
  hotline: string; whatsapp: string; email: string;
  facebook: string; youtube: string; linkedin: string;
  bn: SiteText;
  /** ইংরেজি ঐচ্ছিক — designation আর heroTitle থাকলে তবেই EN বোতাম দেখায় */
  en: SiteText;
};

export const doctorSites = pgTable("doctor_sites", {
  doctorId: text("doctor_id").primaryKey().references(() => doctors.id, { onDelete: "cascade" }),
  published: boolean("published").notNull().default(false),
  content: jsonb("content").$type<SiteContent>().notNull(),
  /** ছোট করা JPEG (data URL) — আলাদা কলামে, যেন তালিকায় ভারী না হয় */
  photo: text("photo"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- relations (db.query.* দিয়ে join করার জন্য) ----
export const doctorsRelations = relations(doctors, ({ many }) => ({ chambers: many(chambers) }));
export const chambersRelations = relations(chambers, ({ one, many }) => ({
  doctor: one(doctors, { fields: [chambers.doctorId], references: [doctors.id] }),
  schedules: many(schedules),
  holidays: many(holidays),
}));
export const schedulesRelations = relations(schedules, ({ one }) => ({
  chamber: one(chambers, { fields: [schedules.chamberId], references: [chambers.id] }),
}));
export const holidaysRelations = relations(holidays, ({ one }) => ({
  chamber: one(chambers, { fields: [holidays.chamberId], references: [chambers.id] }),
}));
export const patientAccountsRelations = relations(patientAccounts, ({ many }) => ({ patients: many(patients) }));
export const patientsRelations = relations(patients, ({ one }) => ({
  account: one(patientAccounts, { fields: [patients.accountId], references: [patientAccounts.id] }),
}));

export type Doctor = typeof doctors.$inferSelect;
export type Chamber = typeof chambers.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Patient = typeof patients.$inferSelect;
