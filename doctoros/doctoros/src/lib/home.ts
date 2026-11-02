import "server-only";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { today, weekday } from "@/lib/time";

const { chambers, doctors, schedules } = schema;

/** হোম পেজের বিভাগ — কোন শব্দ দিয়ে ডাক্তারের specialty মেলানো হবে */
export const SPECIALTIES = [
  { name: "হৃদরোগ", short: "হৃদরোগ", icon: "heart", q: "হৃদ", match: ["হৃদ", "cardio"] },
  { name: "দন্ত চিকিৎসা", short: "দাঁত", icon: "tooth", q: "দন্ত", match: ["দন্ত", "দাঁত", "dent"] },
  { name: "শিশু রোগ", short: "শিশু", icon: "child", q: "শিশু", match: ["শিশু", "pediatr", "paediatr"] },
  { name: "মেডিসিন", short: "মেডিসিন", icon: "steth", q: "মেডিসিন", match: ["মেডিসিন", "medicine"] },
  { name: "নাক-কান-গলা", short: "নাক-কান", icon: "ear", q: "নাক", match: ["নাক", "কান", "ent"] },
  { name: "চর্ম ও যৌন", short: "চর্ম", icon: "skin", q: "চর্ম", match: ["চর্ম", "derma", "skin"] },
  { name: "গাইনি ও প্রসূতি", short: "গাইনি", icon: "gyn", q: "গাইনি", match: ["গাইনি", "প্রসূতি", "gyn", "obs"] },
  { name: "চক্ষু", short: "চক্ষু", icon: "eye", q: "চক্ষু", match: ["চক্ষু", "চোখ", "eye", "ophthal"] },
] as const;

export type OpenChamber = Awaited<ReturnType<typeof openToday>>[number];

/** আজ যেসব চেম্বার খোলা — এখন কত নম্বর চলছে আর কত অনলাইন সিরিয়াল খালি */
export async function openToday(city?: string) {
  const t = today();
  const rows = await db
    .select({
      chamberId: chambers.id,
      chamberName: chambers.name,
      city: chambers.city,
      feeNew: chambers.feeNew,
      dailyLimit: chambers.dailyLimit,
      onlineSharePct: chambers.onlineSharePct,
      startTime: schedules.startTime,
      slug: doctors.slug,
      doctorName: doctors.name,
      specialty: doctors.specialty,
      current: sql<number | null>`(select b.serial_no from bookings b where b.chamber_id = ${chambers.id} and b.date = ${t} and b.status = 'IN_PROGRESS' limit 1)`,
      total: sql<number>`(select count(*)::int from bookings b where b.chamber_id = ${chambers.id} and b.date = ${t} and b.status <> 'CANCELLED')`,
      online: sql<number>`(select count(*)::int from bookings b where b.chamber_id = ${chambers.id} and b.date = ${t} and b.status <> 'CANCELLED' and b.source = 'ONLINE')`,
    })
    .from(chambers)
    .innerJoin(doctors, eq(doctors.id, chambers.doctorId))
    .innerJoin(schedules, and(eq(schedules.chamberId, chambers.id), eq(schedules.weekday, weekday(t))))
    .where(
      and(
        eq(chambers.active, true),
        sql`not exists (select 1 from holidays h where h.chamber_id = ${chambers.id} and h.date = ${t})`,
        city ? eq(chambers.city, city) : sql`true`,
      ),
    )
    .orderBy(asc(schedules.startTime))
    .limit(60);
  return rows.map((r) => {
    const cap = Math.floor((r.dailyLimit * r.onlineSharePct) / 100);
    return { ...r, onlineLeft: Math.max(0, Math.min(cap - r.online, r.dailyLimit - r.total)) };
  });
}

/** ডাক্তার তালিকা — খোঁজা (নাম/বিভাগ/চেম্বার) ও শহর অনুযায়ী */
export async function findDoctors(q: string, city?: string, limit = 12) {
  const like = `%${q}%`;
  return db
    .selectDistinctOn([doctors.id], {
      id: doctors.id,
      slug: doctors.slug,
      name: doctors.name,
      degrees: doctors.degrees,
      specialty: doctors.specialty,
      verified: doctors.bmdcVerified,
      chamberName: chambers.name,
      city: chambers.city,
      fee: chambers.feeNew,
    })
    .from(doctors)
    .innerJoin(chambers, and(eq(chambers.doctorId, doctors.id), eq(chambers.active, true)))
    .where(
      and(
        q ? or(ilike(doctors.name, like), ilike(doctors.specialty, like), ilike(chambers.name, like), ilike(chambers.city, like)) : sql`true`,
        city ? eq(chambers.city, city) : sql`true`,
      ),
    )
    .limit(limit);
}

export async function homeStats() {
  const [specRows, cityRows] = await Promise.all([
    db.select({ specialty: doctors.specialty, n: sql<number>`count(*)::int` }).from(doctors).groupBy(doctors.specialty),
    db.selectDistinct({ city: chambers.city }).from(chambers).where(eq(chambers.active, true)).orderBy(asc(chambers.city)),
  ]);
  const specCounts = SPECIALTIES.map((s) => ({
    ...s,
    count: specRows.filter((r) => s.match.some((m) => r.specialty.toLowerCase().includes(m.toLowerCase()))).reduce((a, r) => a + r.n, 0),
  }));
  return { specCounts, cities: cityRows.map((c) => c.city) };
}
