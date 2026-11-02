// ডেমো অ্যাকাউন্ট — প্রতিবার build-এর সময় চলে (package.json-এর build), বারবার চললেও ডুপ্লিকেট হয় না।
//   DEMO_DATA=0      → কিছু করবে না
//   DEMO_DATA=remove → সব ডেমো ডাক্তার ও ডেমো রোগী মুছে দেবে
// প্রতিদিন প্রথম build-এ ডেমো চেম্বারে "আজকের" কিছু সিরিয়াল তৈরি হয়, যাতে লাইভ কিউ দেখানো যায়।
import "dotenv/config";
import bcrypt from "bcryptjs";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as s from "./schema";

const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
const addDays = (d: string, n: number) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10);
};
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const DOCTORS = [
  {
    phone: "01700000001", slug: "demo-tanvir", name: "ডা. তানভীর আহমেদ", degrees: "MBBS, FCPS (মেডিসিন)", specialty: "হৃদরোগ বিশেষজ্ঞ", years: 12,
    bio: "উচ্চ রক্তচাপ, বুকে ব্যথা ও হৃদরোগের চিকিৎসা করেন। (এটি একটি ডেমো প্রোফাইল)",
    assistant: { phone: "01700000011", name: "করিম (অ্যাসিস্ট্যান্ট)" },
    chambers: [{ name: "শাপলা মেডিকেয়ার", code: "RAJ", address: "সাহেব বাজার", city: "রাজশাহী", feeNew: 800, feeFollowUp: 500, days: ALL_DAYS, start: "17:00", end: "21:00" }],
  },
  {
    phone: "01700000002", slug: "demo-nusrat", name: "ডা. নুসরাত জাহান", degrees: "BDS, MS", specialty: "দন্ত চিকিৎসক", years: 8,
    bio: "দাঁতের ব্যথা, রুট ক্যানেল ও শিশুদের দাঁতের চিকিৎসা। (এটি একটি ডেমো প্রোফাইল)",
    assistant: { phone: "01700000012", name: "সুমি (অ্যাসিস্ট্যান্ট)" },
    chambers: [{ name: "হাসি ডেন্টাল", code: "HSI", address: "লক্ষ্মীপুর মোড়", city: "রাজশাহী", feeNew: 600, feeFollowUp: 300, days: [6, 0, 1, 2, 3, 4], start: "16:00", end: "20:00" }],
  },
  {
    phone: "01700000003", slug: "demo-rashed", name: "ডা. রাশেদ করিম", degrees: "MBBS, DCH", specialty: "শিশু রোগ বিশেষজ্ঞ", years: 10,
    bio: "নবজাতক ও শিশুদের জ্বর, অ্যালার্জি ও টিকা পরামর্শ। (এটি একটি ডেমো প্রোফাইল)",
    assistant: null,
    chambers: [
      { name: "নিরাময় ক্লিনিক", code: "NIR", address: "উপশহর", city: "রাজশাহী", feeNew: 700, feeFollowUp: 400, days: [6, 0, 1, 2, 3, 4], start: "10:00", end: "13:00" },
      { name: "সেবা ডায়াগনস্টিক", code: "NAT", address: "কানাইখালী", city: "নাটোর", feeNew: 600, feeFollowUp: 300, days: [5], start: "10:00", end: "14:00" },
    ],
  },
  {
    phone: "01700000004", slug: "demo-sabrina", name: "ডা. সাবরিনা হক", degrees: "MBBS, FCPS (গাইনি)", specialty: "গাইনি ও প্রসূতি বিশেষজ্ঞ", years: 15,
    bio: "গর্ভকালীন চেকআপ, প্রসূতি ও নারীস্বাস্থ্য। (এটি একটি ডেমো প্রোফাইল)",
    assistant: null,
    chambers: [{ name: "মা ও শিশু কেয়ার", code: "DHK", address: "ধানমন্ডি ২৭", city: "ঢাকা", feeNew: 1000, feeFollowUp: 600, days: ALL_DAYS, start: "18:00", end: "21:00" }],
  },
];

const PATIENTS: { phone: string; members: { name: string; relation: string; gender: string; birthYear: number }[] }[] = [
  { phone: "01800000001", members: [
    { name: "রহিম উদ্দিন", relation: "নিজে", gender: "পুরুষ", birthYear: 1984 },
    { name: "আমেনা খাতুন", relation: "মা", gender: "মহিলা", birthYear: 1958 },
    { name: "আরিফ রহিম", relation: "ছেলে", gender: "পুরুষ", birthYear: 2016 },
  ] },
  { phone: "01800000002", members: [{ name: "শিরিন আক্তার", relation: "নিজে", gender: "মহিলা", birthYear: 1995 }] },
  { phone: "01800000003", members: [{ name: "কামাল হোসেন", relation: "নিজে", gender: "পুরুষ", birthYear: 1971 }] },
  { phone: "01800000004", members: [{ name: "জাহিদ হাসান", relation: "নিজে", gender: "পুরুষ", birthYear: 1964 }, { name: "রাবেয়া হাসান", relation: "স্ত্রী", gender: "মহিলা", birthYear: 1968 }] },
  { phone: "01800000005", members: [{ name: "নাসরিন সুলতানা", relation: "নিজে", gender: "মহিলা", birthYear: 1990 }] },
  { phone: "01800000006", members: [{ name: "মোস্তফা কামাল", relation: "নিজে", gender: "পুরুষ", birthYear: 1975 }] },
];

async function main() {
  const mode = process.env.DEMO_DATA ?? "1";
  if (mode === "0") return console.log("ডেমো ডেটা বন্ধ (DEMO_DATA=0)");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema: s });

  if (mode === "remove") {
    await db.delete(s.users).where(inArray(s.users.phone, DOCTORS.flatMap((d) => [d.phone, ...(d.assistant ? [d.assistant.phone] : [])])));
    await db.delete(s.doctors).where(inArray(s.doctors.slug, DOCTORS.map((d) => d.slug)));
    await db.delete(s.patientAccounts).where(inArray(s.patientAccounts.phone, PATIENTS.map((p) => p.phone)));
    await pool.end();
    return console.log("ডেমো ডেটা মুছে ফেলা হয়েছে");
  }

  const hash = await bcrypt.hash("demo1234", 10);

  // ---- রোগী ----
  const pid: Record<string, string> = {};
  for (const p of PATIENTS) {
    await db.insert(s.patientAccounts).values({ phone: p.phone }).onConflictDoNothing();
    const [acc] = await db.select().from(s.patientAccounts).where(eq(s.patientAccounts.phone, p.phone));
    for (const m of p.members) {
      let [row] = await db.select().from(s.patients).where(and(eq(s.patients.accountId, acc.id), eq(s.patients.name, m.name)));
      if (!row) [row] = await db.insert(s.patients).values({ accountId: acc.id, ...m }).returning();
      pid[m.name] = row.id;
    }
  }

  // ---- ডাক্তার, অ্যাসিস্ট্যান্ট, চেম্বার ----
  const chamberIds: Record<string, string> = {};
  const docIds: Record<string, string> = {};
  for (const d of DOCTORS) {
    const [phoneUsed] = await db.select().from(s.users).where(eq(s.users.phone, d.phone));
    let [doc] = await db.select().from(s.doctors).where(eq(s.doctors.slug, d.slug));
    if (!doc) {
      if (phoneUsed) { console.log(`${d.phone} আগে থেকেই অন্য কেউ ব্যবহার করছেন — ${d.slug} বাদ`); continue; }
      const [u] = await db.insert(s.users).values({ name: d.name, phone: d.phone, passwordHash: hash, role: "DOCTOR" }).returning();
      [doc] = await db.insert(s.doctors).values({
        slug: d.slug, name: d.name, degrees: d.degrees, specialty: d.specialty, bmdcNo: "A-00000", bmdcVerified: false,
        experienceYears: d.years, bio: d.bio, ownerId: u.id,
      }).returning();
      await db.update(s.users).set({ doctorId: doc.id }).where(eq(s.users.id, u.id));
    }
    docIds[d.slug] = doc.id;
    if (d.assistant) {
      await db.insert(s.users).values({ name: d.assistant.name, phone: d.assistant.phone, passwordHash: hash, role: "ASSISTANT", doctorId: doc.id }).onConflictDoNothing();
    }
    for (const c of d.chambers) {
      let [ch] = await db.select().from(s.chambers).where(and(eq(s.chambers.doctorId, doc.id), eq(s.chambers.code, c.code)));
      if (!ch) {
        [ch] = await db.insert(s.chambers).values({
          doctorId: doc.id, name: c.name, code: c.code, address: c.address, city: c.city,
          feeNew: c.feeNew, feeFollowUp: c.feeFollowUp, avgMinutes: 10, dailyLimit: 30, onlineSharePct: 60,
        }).returning();
        await db.insert(s.schedules).values(c.days.map((w) => ({ chamberId: ch.id, weekday: w, startTime: c.start, endTime: c.end })));
      }
      chamberIds[c.code] = ch.id;
    }
  }

  const mk = (code: string, slug: string, patient: string, date: string, serialNo: number, status: (typeof s.bookingStatusEnum.enumValues)[number], source: "ONLINE" | "WALK_IN", extra: Partial<typeof s.bookings.$inferInsert> = {}) => ({
    code: `${code}-${date.slice(5, 7)}${date.slice(8, 10)}-${String(serialNo).padStart(2, "0")}`,
    chamberId: chamberIds[code], doctorId: docIds[slug], patientId: pid[patient], date, serialNo, status, source, ...extra,
  });

  // ---- আগের ভিজিট, প্রেসক্রিপশন ও ফলোআপ (একবারই) ----
  if (chamberIds.RAJ && chamberIds.HSI) {
    const [hasHistory] = await db.select({ id: s.visits.id }).from(s.visits).where(eq(s.visits.doctorId, docIds["demo-tanvir"])).limit(1);
    if (!hasHistory) {
      const p1 = addDays(TODAY, -21), p2 = addDays(TODAY, -6);
      const [b1, b2, b3, b4] = await db.insert(s.bookings).values([
        mk("RAJ", "demo-tanvir", "রহিম উদ্দিন", p1, 1, "DONE", "ONLINE"),
        mk("RAJ", "demo-tanvir", "আমেনা খাতুন", p1, 2, "DONE", "ONLINE"),
        mk("HSI", "demo-nusrat", "আরিফ রহিম", p2, 1, "DONE", "WALK_IN"),
        mk("RAJ", "demo-tanvir", "মোস্তফা কামাল", p2, 1, "DONE", "WALK_IN"),
      ]).onConflictDoNothing().returning();
      if (b1 && b2 && b3 && b4) {
        const vs = await db.insert(s.visits).values([
          { bookingId: b1.id, doctorId: b1.doctorId, patientId: b1.patientId, complaint: "মাঝে মাঝে বুক ধড়ফড়", diagnosis: "উচ্চ রক্তচাপ", medicines: [{ name: "Amlodipine 5mg", dose: "০+০+১", when: "রাতে", days: "৩০ দিন" }, { name: "Rosuvastatin 10mg", dose: "০+০+১", when: "রাতে", days: "৩০ দিন" }], advice: "লবণ কম খাবেন, প্রতিদিন ৩০ মিনিট হাঁটবেন", followUpDate: addDays(TODAY, 9) },
          { bookingId: b2.id, doctorId: b2.doctorId, patientId: b2.patientId, diagnosis: "ডায়াবেটিস ও উচ্চ রক্তচাপ", medicines: [{ name: "Losartan 50mg", dose: "১+০+০", when: "সকালে", days: "৩০ দিন" }], advice: "ইসিজি ও HbA1c পরীক্ষা করে আসবেন", followUpDate: addDays(TODAY, 1) },
          { bookingId: b3.id, doctorId: b3.doctorId, patientId: b3.patientId, complaint: "দাঁতে ব্যথা", diagnosis: "ক্যাভিটি", medicines: [{ name: "Paracetamol 250mg", dose: "১+১+১", when: "খাবারের পরে", days: "৩ দিন" }], advice: "মিষ্টি কম খাবে, দিনে দুবার ব্রাশ", followUpDate: null },
          { bookingId: b4.id, doctorId: b4.doctorId, patientId: b4.patientId, diagnosis: "বুকে ব্যথা", medicines: [{ name: "Atorvastatin 20mg", dose: "০+০+১", when: "রাতে", days: "৩০ দিন" }], advice: "ইসিজি করে আসবেন", followUpDate: addDays(TODAY, -2) },
        ]).returning();
        await db.insert(s.followUps).values([
          { doctorId: vs[0].doctorId, patientId: vs[0].patientId, visitId: vs[0].id, dueDate: addDays(TODAY, 9) },
          { doctorId: vs[1].doctorId, patientId: vs[1].patientId, visitId: vs[1].id, dueDate: addDays(TODAY, 1) },
          { doctorId: vs[3].doctorId, patientId: vs[3].patientId, visitId: vs[3].id, dueDate: addDays(TODAY, -2), status: "MISSED", remindedAt: new Date() },
        ]);
      }
    }
  }

  // ---- আজকের লাইভ কিউ (প্রতিদিন একবার) ----
  const todayQueue: [string, string, string[]][] = [
    ["RAJ", "demo-tanvir", ["শিরিন আক্তার", "কামাল হোসেন", "জাহিদ হাসান", "নাসরিন সুলতানা", "রহিম উদ্দিন", "রাবেয়া হাসান"]],
    ["HSI", "demo-nusrat", ["নাসরিন সুলতানা", "আরিফ রহিম", "শিরিন আক্তার"]],
    ["DHK", "demo-sabrina", ["রাবেয়া হাসান", "শিরিন আক্তার"]],
  ];
  const wd = new Date(`${TODAY}T12:00:00Z`).getUTCDay();
  for (const [code, slug, names] of todayQueue) {
    const chamberId = chamberIds[code];
    if (!chamberId) continue;
    const open = await db.select().from(s.schedules).where(and(eq(s.schedules.chamberId, chamberId), eq(s.schedules.weekday, wd)));
    if (open.length === 0) continue;
    const [any] = await db.select({ id: s.bookings.id }).from(s.bookings).where(and(eq(s.bookings.chamberId, chamberId), eq(s.bookings.date, TODAY))).limit(1);
    if (any) continue;
    const now = Date.now();
    const statuses: (typeof s.bookingStatusEnum.enumValues)[number][] = ["DONE", "DONE", "IN_PROGRESS", "WAITING", "WAITING", "WAITING"];
    await db.insert(s.bookings).values(names.map((n, i) => mk(code, slug, n, TODAY, i + 1, statuses[i] ?? "WAITING", i % 2 ? "WALK_IN" : "ONLINE",
      statuses[i] === "DONE" ? { completedAt: new Date(now - (25 - i * 11) * 60000) } : statuses[i] === "IN_PROGRESS" ? { calledAt: new Date(now - 4 * 60000) } : {},
    ))).onConflictDoNothing();
  }

  // ---- রহিম সাহেবের কালকের একটি আসন্ন সিরিয়াল ----
  if (chamberIds.HSI) {
    const tmr = addDays(TODAY, 1);
    const twd = new Date(`${tmr}T12:00:00Z`).getUTCDay();
    const open = await db.select().from(s.schedules).where(and(eq(s.schedules.chamberId, chamberIds.HSI), eq(s.schedules.weekday, twd)));
    const [has] = await db.select({ id: s.bookings.id }).from(s.bookings).where(and(eq(s.bookings.chamberId, chamberIds.HSI), eq(s.bookings.date, tmr), eq(s.bookings.patientId, pid["আরিফ রহিম"]))).limit(1);
    if (open.length && !has) {
      const existing = await db.select({ n: s.bookings.serialNo }).from(s.bookings).where(and(eq(s.bookings.chamberId, chamberIds.HSI), eq(s.bookings.date, tmr)));
      const next = existing.reduce((a, r) => Math.max(a, r.n), 0) + 1;
      await db.insert(s.bookings).values(mk("HSI", "demo-nusrat", "আরিফ রহিম", tmr, next, "WAITING", "ONLINE")).onConflictDoNothing();
    }
  }

  console.log("ডেমো ডেটা প্রস্তুত");
  await pool.end();
}

main().catch((e) => {
  // ডেমো ডেটার কোনো সমস্যায় যেন আসল সাইটের build আটকে না যায়
  console.error("ডেমো ডেটা তৈরি করা যায়নি:", e);
  process.exit(0);
});
