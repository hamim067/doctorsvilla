import "server-only";
import { and, eq, inArray, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { notifyPatient } from "@/lib/notify";
import { addDays, formatDateBn, today } from "@/lib/time";

const { doctors, followUps, patientAccounts, patients } = schema;

/**
 * প্রতিদিন একবার চলবে (Vercel Cron বা যেকোনো শিডিউলার থেকে /api/cron/followups):
 * ১. আগামীকাল যাদের ফলোআপ, তাদের বুকিং লিংকসহ রিমাইন্ডার (PRD §১৯)
 * ২. তারিখ পেরিয়ে গেছে কিন্তু সিরিয়াল নেননি → MISSED, অ্যাসিস্ট্যান্টের "ফলোআপ মিস" তালিকায়
 * একাধিকবার চললেও একজন দুবার মেসেজ পাবেন না (শুধু PENDING-দের পাঠানো হয়)।
 */
export async function runFollowUpJob(now = new Date()) {
  const t = today(now);
  const tomorrow = addDays(t, 1);
  const appUrl = process.env.APP_URL ?? "";

  const due = await db
    .select({ fu: followUps, name: patients.name, phone: patientAccounts.phone, doctorName: doctors.name, slug: doctors.slug })
    .from(followUps)
    .innerJoin(patients, eq(patients.id, followUps.patientId))
    .innerJoin(patientAccounts, eq(patientAccounts.id, patients.accountId))
    .innerJoin(doctors, eq(doctors.id, followUps.doctorId))
    // আজ বা কালকের, যারা এখনো রিমাইন্ডার পাননি (কাল কাজ না চললেও আজ ধরা পড়বে)
    .where(and(eq(followUps.status, "PENDING"), inArray(followUps.dueDate, [t, tomorrow])));

  let reminded = 0;
  for (const r of due) {
    await notifyPatient({
      doctorId: r.fu.doctorId,
      phone: r.phone,
      purpose: "followup",
      body: `${r.name}, ${formatDateBn(r.fu.dueDate)} ${r.doctorName}-এর সাথে আপনার ফলোআপ। সিরিয়াল নিন: ${appUrl}/dr/${r.slug}`,
    });
    await db.update(followUps).set({ status: "REMINDED", remindedAt: new Date() }).where(eq(followUps.id, r.fu.id));
    reminded++;
  }

  const missed = await db
    .update(followUps)
    .set({ status: "MISSED" })
    .where(and(inArray(followUps.status, ["PENDING", "REMINDED"]), lt(followUps.dueDate, t)))
    .returning({ id: followUps.id });

  return { date: t, reminded, missed: missed.length };
}
