import "server-only";
import { and, eq, inArray, max, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { notifyPatient } from "@/lib/notify";
import { addDays, bn, formatDateBn, today, weekday } from "@/lib/time";

const { bookings, chambers, doctors, followUps, holidays, patientAccounts, patients, schedules } = schema;

export const ONLINE_BOOKING_DAYS = 14;

/** 01712345678 / +8801712345678 / 8801712345678 → 01712345678; ভুল হলে null */
export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/[^\d]/g, "").replace(/^880/, "0").replace(/^88(?=01)/, "");
  return /^01[3-9]\d{8}$/.test(d) ? d : null;
}

export const patientCode = (n: number) => `P-${10000 + n}`;

export class BookingError extends Error {}

/** এই দিনে চেম্বার খোলা কিনা, আর কত সিরিয়াল বাকি */
export async function dayAvailability(chamberId: string, date: string) {
  const [chamber] = await db.select().from(chambers).where(eq(chambers.id, chamberId)).limit(1);
  if (!chamber || !chamber.active) return { open: false as const, reason: "চেম্বার পাওয়া যায়নি" };
  const [sch] = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.chamberId, chamberId), eq(schedules.weekday, weekday(date))))
    .limit(1);
  if (!sch) return { open: false as const, reason: "এই দিন চেম্বার বন্ধ" };
  const [hol] = await db.select().from(holidays).where(and(eq(holidays.chamberId, chamberId), eq(holidays.date, date))).limit(1);
  if (hol) return { open: false as const, reason: hol.note ? `ছুটি: ${hol.note}` : "ছুটি" };

  const rows = await db
    .select({ source: bookings.source, n: sql<number>`count(*)::int` })
    .from(bookings)
    .where(and(eq(bookings.chamberId, chamberId), eq(bookings.date, date), ne(bookings.status, "CANCELLED")))
    .groupBy(bookings.source);
  const online = rows.find((r) => r.source === "ONLINE")?.n ?? 0;
  const total = rows.reduce((a, r) => a + r.n, 0);
  const onlineCap = Math.floor((chamber.dailyLimit * chamber.onlineSharePct) / 100);
  return {
    open: true as const,
    schedule: sch,
    chamber,
    total,
    onlineLeft: Math.max(0, Math.min(onlineCap - online, chamber.dailyLimit - total)),
    totalLeft: Math.max(0, chamber.dailyLimit - total),
  };
}

type NewBookingInput = {
  chamberId: string;
  date: string;
  source: "ONLINE" | "WALK_IN";
  /** চেনা রোগী (অ্যাসিস্ট্যান্ট খুঁজে বের করেছেন) */
  patientId?: string;
  /** নতুন/অনলাইন রোগী */
  phone?: string;
  name?: string;
  gender?: string | null;
  birthYear?: number | null;
};

/**
 * সিরিয়াল দেওয়ার মূল নিয়ম (PRD §১৩):
 * - প্রতিটি চেম্বারে প্রতিদিন সিরিয়াল ১ থেকে শুরু
 * - কোড: চেম্বার কোড + মাস-দিন + সিরিয়াল, যেমন RAJ-1102-07
 * - অনলাইন ও সরাসরি আসা রোগী একই লাইনে
 * - একই সময়ে দুজন বুক করলেও একই নাম্বার পাবে না (ইউনিক ইনডেক্স + আবার চেষ্টা)
 */
export async function createBooking(input: NewBookingInput) {
  const t = today();
  if (input.date < t) throw new BookingError("আগের তারিখে সিরিয়াল দেওয়া যাবে না");
  if (input.source === "ONLINE" && input.date > addDays(t, ONLINE_BOOKING_DAYS))
    throw new BookingError(`অনলাইনে সর্বোচ্চ ${bn(ONLINE_BOOKING_DAYS)} দিন আগে সিরিয়াল নেওয়া যায়`);

  const avail = await dayAvailability(input.chamberId, input.date);
  if (!avail.open) throw new BookingError(avail.reason);
  if (input.source === "ONLINE" && avail.onlineLeft <= 0) throw new BookingError("এই দিনের অনলাইন সিরিয়াল শেষ");
  // সরাসরি আসা রোগীর জন্য লিমিট পেরোলেও অ্যাসিস্ট্যান্ট দিতে পারবেন — ডাক্তারের সিদ্ধান্ত
  const { chamber } = avail;

  // ---- রোগী খুঁজে বের করা বা নতুন বানানো ----
  let patient: typeof patients.$inferSelect;
  let phone: string;
  if (input.patientId) {
    const [p] = await db
      .select({ p: patients, phone: patientAccounts.phone })
      .from(patients)
      .innerJoin(patientAccounts, eq(patientAccounts.id, patients.accountId))
      .where(eq(patients.id, input.patientId))
      .limit(1);
    if (!p) throw new BookingError("রোগী পাওয়া যায়নি");
    patient = p.p;
    phone = p.phone;
  } else {
    const ph = normalizePhone(input.phone ?? "");
    const name = (input.name ?? "").trim();
    if (!ph) throw new BookingError("সঠিক মোবাইল নাম্বার দিন (যেমন 01712345678)");
    if (name.length < 2) throw new BookingError("রোগীর নাম দিন");
    phone = ph;
    patient = await findOrCreatePatient(ph, name, input.gender ?? null, input.birthYear ?? null);
  }

  // একই রোগী একই দিনে একই চেম্বারে দুবার নয়
  const [dup] = await db
    .select({ id: bookings.id, serialNo: bookings.serialNo })
    .from(bookings)
    .where(
      and(
        eq(bookings.chamberId, chamber.id),
        eq(bookings.date, input.date),
        eq(bookings.patientId, patient.id),
        ne(bookings.status, "CANCELLED"),
      ),
    )
    .limit(1);
  if (dup) throw new BookingError(`${patient.name}-এর এই দিনে আগেই সিরিয়াল ${bn(dup.serialNo)} আছে`);

  // ডাক্তারের দেওয়া ফলোআপ বাকি থাকলে এটা ফলোআপ ভিজিট
  const [fu] = await db
    .select()
    .from(followUps)
    .where(
      and(
        eq(followUps.doctorId, chamber.doctorId),
        eq(followUps.patientId, patient.id),
        inArray(followUps.status, ["PENDING", "REMINDED", "MISSED"]),
      ),
    )
    .orderBy(followUps.dueDate)
    .limit(1);

  const mmdd = input.date.slice(5, 7) + input.date.slice(8, 10);

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const booking = await db.transaction(async (tx) => {
        // চেম্বারের রো লক: একই চেম্বারের সিরিয়াল একটার পর একটা দেওয়া হয়, তাই ভিড়েও কেউ আটকায় না
        await tx.execute(sql`select id from chambers where id = ${chamber.id} for update`);
        const [{ m }] = await tx
          .select({ m: max(bookings.serialNo) })
          .from(bookings)
          .where(and(eq(bookings.chamberId, chamber.id), eq(bookings.date, input.date)));
        const serialNo = (m ?? 0) + 1;
        const [b] = await tx
          .insert(bookings)
          .values({
            code: `${chamber.code}-${mmdd}-${String(serialNo).padStart(2, "0")}`,
            chamberId: chamber.id,
            doctorId: chamber.doctorId,
            patientId: patient.id,
            date: input.date,
            serialNo,
            source: input.source,
            type: fu ? "FOLLOW_UP" : "NEW",
          })
          .returning();
        if (fu) await tx.update(followUps).set({ status: "BOOKED", bookingId: b.id }).where(eq(followUps.id, fu.id));
        return b;
      });

      const [doc] = await db.select({ name: doctors.name }).from(doctors).where(eq(doctors.id, chamber.doctorId)).limit(1);
      await notifyPatient({
        doctorId: chamber.doctorId,
        phone,
        purpose: "booking",
        body:
          `${patient.name}, ${doc?.name ?? ""}-এর ${chamber.name}-এ ${formatDateBn(input.date)} আপনার সিরিয়াল ${bn(booking.serialNo)} (${booking.code})। ` +
          `লাইভ সিরিয়াল: ${process.env.APP_URL ?? ""}/live/${booking.id}`,
      });
      return { booking, patient, chamber };
    } catch (e) {
      // 23505 = একই সিরিয়াল আরেকজন এইমাত্র নিয়েছে → আবার চেষ্টা
      if ((e as { code?: string })?.code === "23505" || (e as { cause?: { code?: string } })?.cause?.code === "23505") continue;
      throw e;
    }
  }
  throw new BookingError("এখন অনেকে একসাথে বুক করছেন, আবার চেষ্টা করুন");
}

export async function findOrCreatePatient(phone: string, name: string, gender: string | null, birthYear: number | null) {
  await db.insert(patientAccounts).values({ phone }).onConflictDoNothing();
  const [acc] = await db.select().from(patientAccounts).where(eq(patientAccounts.phone, phone)).limit(1);
  const [existing] = await db
    .select()
    .from(patients)
    .where(and(eq(patients.accountId, acc.id), sql`lower(trim(${patients.name})) = lower(${name})`))
    .limit(1);
  if (existing) return existing;
  const [p] = await db.insert(patients).values({ accountId: acc.id, name, gender, birthYear }).returning();
  return p;
}

/** পরের ১৪ দিনে কোন দিন খোলা আর কত অনলাইন সিরিয়াল বাকি (এক কোয়েরিতে) */
export async function upcomingDays(chamber: typeof chambers.$inferSelect & { schedules: (typeof schedules.$inferSelect)[] }) {
  const t = today();
  const last = addDays(t, ONLINE_BOOKING_DAYS);
  const [counts, hols] = await Promise.all([
    db
      .select({ date: bookings.date, source: bookings.source, n: sql<number>`count(*)::int` })
      .from(bookings)
      .where(and(eq(bookings.chamberId, chamber.id), ne(bookings.status, "CANCELLED"), sql`${bookings.date} between ${t} and ${last}`))
      .groupBy(bookings.date, bookings.source),
    db.select().from(holidays).where(and(eq(holidays.chamberId, chamber.id), sql`${holidays.date} between ${t} and ${last}`)),
  ]);
  const onlineCap = Math.floor((chamber.dailyLimit * chamber.onlineSharePct) / 100);
  const days: { date: string; open: boolean; onlineLeft: number; startTime?: string; endTime?: string; note?: string }[] = [];
  for (let i = 0; i <= ONLINE_BOOKING_DAYS; i++) {
    const date = addDays(t, i);
    const sch = chamber.schedules.find((s) => s.weekday === weekday(date));
    const hol = hols.find((h) => h.date === date);
    if (!sch || hol) {
      if (sch && hol) days.push({ date, open: false, onlineLeft: 0, note: hol.note ?? "ছুটি" });
      continue;
    }
    const online = counts.find((c) => c.date === date && c.source === "ONLINE")?.n ?? 0;
    const total = counts.filter((c) => c.date === date).reduce((a, c) => a + c.n, 0);
    days.push({
      date,
      open: true,
      onlineLeft: Math.max(0, Math.min(onlineCap - online, chamber.dailyLimit - total)),
      startTime: sch.startTime,
      endTime: sch.endTime,
    });
  }
  return days;
}
