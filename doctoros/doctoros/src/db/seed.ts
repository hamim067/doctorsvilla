// ডেমো ডেটা: npm run db:seed
// লগইন — ডাক্তার: 01700000001 / demo1234 · অ্যাসিস্ট্যান্ট: 01700000002 / demo1234
import "dotenv/config";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as s from "./schema";

const TZ_TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
const addDays = (d: string, n: number) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10);
};

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema: s });
  const [existing] = await db.select().from(s.users).limit(1);
  if (existing) {
    console.log("ডেটাবেসে আগেই ডেটা আছে — seed বাদ দেওয়া হলো");
    await pool.end();
    return;
  }
  const hash = await bcrypt.hash("demo1234", 10);

  const [owner] = await db.insert(s.users).values({ name: "ডা. তানভীর আহমেদ", phone: "01700000001", passwordHash: hash, role: "DOCTOR" }).returning();
  const [doc] = await db.insert(s.doctors).values({
    slug: "dr-tanvir",
    name: "ডা. তানভীর আহমেদ",
    degrees: "MBBS, FCPS (মেডিসিন)",
    specialty: "হৃদরোগ বিশেষজ্ঞ",
    bmdcNo: "A-12345",
    bmdcVerified: true,
    experienceYears: 12,
    bio: "উচ্চ রক্তচাপ, হার্টের ব্যথা ও হৃদরোগের চিকিৎসা করেন। (ডেমো প্রোফাইল)",
    ownerId: owner.id,
  }).returning();
  await db.update(s.users).set({ doctorId: doc.id });
  await db.insert(s.users).values({ name: "করিম", phone: "01700000002", passwordHash: hash, role: "ASSISTANT", doctorId: doc.id });

  const [ch] = await db.insert(s.chambers).values({
    doctorId: doc.id, name: "শাপলা মেডিকেয়ার", code: "RAJ", address: "সাহেব বাজার", city: "রাজশাহী",
    feeNew: 800, feeFollowUp: 500, avgMinutes: 10, dailyLimit: 30, onlineSharePct: 60,
  }).returning();
  // ডেমোতে প্রতিদিন খোলা, যাতে আজই পরীক্ষা করা যায়
  await db.insert(s.schedules).values([0, 1, 2, 3, 4, 5, 6].map((w) => ({ chamberId: ch.id, weekday: w, startTime: w === 4 ? "16:00" : "18:00", endTime: "21:00" })));

  const people = [
    ["01711000001", "আব্দুল করিম", "পুরুষ", 1968], ["01711000002", "নাসরিন সুলতানা", "মহিলা", 1990],
    ["01711000003", "মোস্তফা কামাল", "পুরুষ", 1975], ["01711000004", "কামাল হোসেন", "পুরুষ", 1971],
    ["01711000005", "শিরিন আক্তার", "মহিলা", 1995], ["01711000006", "জাহিদ হাসান", "পুরুষ", 1964],
    ["01711000006", "রাবেয়া হাসান", "মহিলা", 1968], ["01711000007", "রহিম উদ্দিন", "পুরুষ", 1984],
  ] as const;
  const pats: (typeof s.patients.$inferSelect)[] = [];
  for (const [phone, name, gender, birthYear] of people) {
    await db.insert(s.patientAccounts).values({ phone }).onConflictDoNothing();
    const acc = (await db.select().from(s.patientAccounts)).find((a) => a.phone === phone)!;
    const [p] = await db.insert(s.patients).values({ accountId: acc.id, name, gender, birthYear }).returning();
    pats.push(p);
  }

  // আগের একটি ভিজিট + ফলোআপ (রাবেয়া — কাল ফলোআপ; মোস্তফা — মিস করেছেন)
  const past = addDays(TZ_TODAY, -14);
  const mk = (i: number, date: string, serialNo: number, status: (typeof s.bookingStatusEnum.enumValues)[number], source: "ONLINE" | "WALK_IN", extra = {}) => ({
    code: `RAJ-${date.slice(5, 7)}${date.slice(8, 10)}-${String(serialNo).padStart(2, "0")}`,
    chamberId: ch.id, doctorId: doc.id, patientId: pats[i].id, date, serialNo, status, source, ...extra,
  });
  const [b1, b2] = await db.insert(s.bookings).values([mk(6, past, 1, "DONE", "ONLINE"), mk(2, past, 2, "DONE", "WALK_IN")]).returning();
  const [v1, v2] = await db.insert(s.visits).values([
    { bookingId: b1.id, doctorId: doc.id, patientId: pats[6].id, diagnosis: "উচ্চ রক্তচাপ", medicines: [{ name: "Amlodipine 5mg", dose: "০+০+১", when: "রাতে", days: "৩০ দিন" }], advice: "লবণ কম খাবেন", followUpDate: addDays(TZ_TODAY, 1) },
    { bookingId: b2.id, doctorId: doc.id, patientId: pats[2].id, diagnosis: "বুকে ব্যথা", medicines: [{ name: "Atorvastatin 20mg", dose: "০+০+১", when: "রাতে", days: "৩০ দিন" }], advice: "ইসিজি করে আসবেন", followUpDate: addDays(TZ_TODAY, -3) },
  ]).returning();
  await db.insert(s.followUps).values([
    { doctorId: doc.id, patientId: pats[6].id, visitId: v1.id, dueDate: addDays(TZ_TODAY, 1) },
    { doctorId: doc.id, patientId: pats[2].id, visitId: v2.id, dueDate: addDays(TZ_TODAY, -3), status: "MISSED", remindedAt: new Date() },
  ]);

  // আজকের কিউ: ১–৩ সম্পন্ন/অনুপস্থিত, ৪ চলছে, ৫–৮ অপেক্ষমাণ
  const now = Date.now();
  const min = (m: number) => new Date(now - m * 60000);
  await db.insert(s.bookings).values([
    mk(0, TZ_TODAY, 1, "DONE", "ONLINE", { completedAt: min(32) }),
    mk(1, TZ_TODAY, 2, "ABSENT", "ONLINE"),
    mk(3, TZ_TODAY, 3, "DONE", "WALK_IN", { completedAt: min(20) }),
    mk(5, TZ_TODAY, 4, "DONE", "ONLINE", { completedAt: min(9) }),
    mk(4, TZ_TODAY, 5, "IN_PROGRESS", "WALK_IN", { calledAt: min(8) }),
    mk(7, TZ_TODAY, 6, "WAITING", "ONLINE"),
  ]);

  console.log("ডেমো ডেটা তৈরি হয়েছে।\nডাক্তার: 01700000001 / demo1234\nঅ্যাসিস্ট্যান্ট: 01700000002 / demo1234\nপ্রোফাইল: /dr/dr-tanvir");
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
