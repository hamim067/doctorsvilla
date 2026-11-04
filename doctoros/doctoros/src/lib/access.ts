// গোপনীয়তার নিয়ম — সব জায়গায় এখান থেকেই যাচাই:
//  ১. রোগী শুধু নিজের আর নিজের পরিবারের তথ্য দেখবেন (lib/patient-auth → familyOf)
//  ২. ডাক্তার শুধু নিজের রোগীদের তথ্য দেখবেন (doctorHasPatient)
//  ৩. অ্যাসিস্ট্যান্ট প্রেসক্রিপশন দেখবেন শুধু ডাক্তার অনুমতি দিলে (canSeeRx)
import "server-only";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import type { Session } from "@/lib/auth";

export async function canSeeRx(s: Session) {
  if (s.role !== "ASSISTANT") return true;
  const [d] = await db.select({ ok: schema.doctors.assistantRxAccess }).from(schema.doctors).where(eq(schema.doctors.id, s.doctorId)).limit(1);
  return Boolean(d?.ok);
}

/** প্রেসক্রিপশনের পেজ/অ্যাকশনে — অনুমতি না থাকলে কিউ পেজে ফেরত */
export async function requireRx(s: Session) {
  if (!(await canSeeRx(s))) redirect("/dashboard/queue?rx=denied");
}

/** এই রোগী কি এই ডাক্তারের কাছে কখনো সিরিয়াল নিয়েছেন? না নিলে তার কোনো তথ্য দেখা যাবে না */
export async function doctorHasPatient(doctorId: string, patientId: string) {
  const [b] = await db.select({ id: schema.bookings.id }).from(schema.bookings)
    .where(and(eq(schema.bookings.doctorId, doctorId), eq(schema.bookings.patientId, patientId))).limit(1);
  return Boolean(b);
}
