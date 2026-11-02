import "server-only";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { notifyPatient } from "@/lib/notify";
import { bn } from "@/lib/time";

const { bookings, chambers, patients, patientAccounts } = schema;

export type QueueRow = {
  id: string;
  code: string;
  serialNo: number;
  status: (typeof bookings.$inferSelect)["status"];
  source: (typeof bookings.$inferSelect)["source"];
  type: (typeof bookings.$inferSelect)["type"];
  patientId: string;
  patientName: string;
  patientNumber: number;
  phone: string;
  completedAt: Date | null;
};

export async function getQueue(chamberId: string, date: string): Promise<QueueRow[]> {
  return db
    .select({
      id: bookings.id,
      code: bookings.code,
      serialNo: bookings.serialNo,
      status: bookings.status,
      source: bookings.source,
      type: bookings.type,
      patientId: patients.id,
      patientName: patients.name,
      patientNumber: patients.number,
      phone: patientAccounts.phone,
      completedAt: bookings.completedAt,
    })
    .from(bookings)
    .innerJoin(patients, eq(patients.id, bookings.patientId))
    .innerJoin(patientAccounts, eq(patientAccounts.id, patients.accountId))
    .where(and(eq(bookings.chamberId, chamberId), eq(bookings.date, date), ne(bookings.status, "CANCELLED")))
    .orderBy(asc(bookings.serialNo));
}

/**
 * প্রতি রোগীতে গড় সময় (PRD §২০):
 * আজ অন্তত ২ জন সম্পন্ন হলে পরপর দুই "সম্পন্ন"-এর মাঝের সময়ের গড়;
 * ১ থেকে ৬০ মিনিটের বাইরের ফাঁক (বিরতি, নামাজ) বাদ। না হলে চেম্বার সেটিংয়ের গড়।
 */
export function averageMinutes(rows: Pick<QueueRow, "completedAt">[], fallback: number) {
  const times = rows
    .map((r) => r.completedAt?.getTime())
    .filter((t): t is number => typeof t === "number")
    .sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) {
    const m = (times[i] - times[i - 1]) / 60000;
    if (m >= 1 && m <= 60) gaps.push(m);
  }
  if (gaps.length === 0) return fallback;
  // সাম্প্রতিক ৮টা দেখি, যাতে ডাক্তারের এখনকার গতি ধরা পড়ে
  const recent = gaps.slice(-8);
  return Math.max(1, Math.round(recent.reduce((a, b) => a + b, 0) / recent.length));
}

export async function liveState(chamberId: string, date: string) {
  const [chamber] = await db.select().from(chambers).where(eq(chambers.id, chamberId)).limit(1);
  if (!chamber) return null;
  const rows = await getQueue(chamberId, date);
  const current = rows.find((r) => r.status === "IN_PROGRESS") ?? null;
  const waiting = rows.filter((r) => r.status === "WAITING");
  const avg = averageMinutes(rows, chamber.avgMinutes);
  return {
    chamber,
    rows,
    current,
    waiting,
    avg,
    total: rows.length,
    done: rows.filter((r) => r.status === "DONE").length,
    absent: rows.filter((r) => r.status === "ABSENT").length,
  };
}

/** এই সিরিয়ালের আগে কতজন, আর আনুমানিক কত মিনিট */
export function etaFor(state: NonNullable<Awaited<ReturnType<typeof liveState>>>, serialNo: number) {
  const ahead = state.waiting.filter((r) => r.serialNo < serialNo).length + (state.current ? 1 : 0);
  return { ahead, minutes: ahead * state.avg };
}

/**
 * অ্যাসিস্ট্যান্টের বাটন:
 *  done   — চলমান রোগী সম্পন্ন, পরের জনকে ডাকা
 *  absent — চলমান রোগী অনুপস্থিত, পরের জনকে ডাকা
 *  start  — কেউ চলছে না, প্রথম অপেক্ষমাণকে ডাকা
 * চেম্বারের রো লক করি, যাতে দুজন একসাথে চাপলে গোলমাল না হয়।
 */
export async function advanceQueue(chamberId: string, date: string, action: "done" | "absent" | "start") {
  const called = await db.transaction(async (tx) => {
    await tx.execute(sql`select id from chambers where id = ${chamberId} for update`);
    const [cur] = await tx
      .select()
      .from(bookings)
      .where(and(eq(bookings.chamberId, chamberId), eq(bookings.date, date), eq(bookings.status, "IN_PROGRESS")))
      .limit(1);
    if (cur && action !== "start") {
      await tx
        .update(bookings)
        .set(action === "done" ? { status: "DONE", completedAt: new Date() } : { status: "ABSENT" })
        .where(eq(bookings.id, cur.id));
    } else if (cur && action === "start") {
      return null; // কেউ আগেই চলছে
    }
    const [next] = await tx
      .select()
      .from(bookings)
      .where(and(eq(bookings.chamberId, chamberId), eq(bookings.date, date), eq(bookings.status, "WAITING")))
      .orderBy(asc(bookings.serialNo))
      .limit(1);
    if (!next) return null;
    await tx.update(bookings).set({ status: "IN_PROGRESS", calledAt: new Date() }).where(eq(bookings.id, next.id));
    return next;
  });

  if (called && process.env.QUEUE_SMS_ALERT === "1") await alertTwoAhead(chamberId, date);
  return called;
}

/** অনুপস্থিত রোগী পরে এলে আবার লাইনে (নিজের নাম্বারেই) */
export async function requeue(bookingId: string) {
  await db.update(bookings).set({ status: "WAITING" }).where(and(eq(bookings.id, bookingId), eq(bookings.status, "ABSENT")));
}

/** "আপনার আগে আর ২ জন" — এসএমএসে খরচ আছে, তাই QUEUE_SMS_ALERT=1 হলেই চালু; অ্যাপ এলে পুশে যাবে */
async function alertTwoAhead(chamberId: string, date: string) {
  const state = await liveState(chamberId, date);
  if (!state) return;
  const target = state.waiting[1]; // চলমান + ১ জন অপেক্ষমাণ = আগে ২ জন
  if (!target) return;
  await notifyPatient({
    doctorId: state.chamber.doctorId,
    phone: target.phone,
    purpose: "queue",
    body: `${target.patientName}, আপনার সিরিয়াল ${bn(target.serialNo)} আসতে আর ২ জন বাকি। ${state.chamber.name}-এ চলে আসুন।`,
  });
}
