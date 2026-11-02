"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireStaff } from "@/lib/auth";
import { str } from "@/lib/form";
import { notifyPatient } from "@/lib/notify";

export async function resendReminder(fd: FormData) {
  const s = await requireStaff();
  const [r] = await db
    .select({ fu: schema.followUps, name: schema.patients.name, phone: schema.patientAccounts.phone, doctor: schema.doctors })
    .from(schema.followUps)
    .innerJoin(schema.patients, eq(schema.patients.id, schema.followUps.patientId))
    .innerJoin(schema.patientAccounts, eq(schema.patientAccounts.id, schema.patients.accountId))
    .innerJoin(schema.doctors, eq(schema.doctors.id, schema.followUps.doctorId))
    .where(and(eq(schema.followUps.id, str(fd, "id")), eq(schema.followUps.doctorId, s.doctorId)))
    .limit(1);
  if (!r) return;
  await notifyPatient({
    doctorId: s.doctorId,
    phone: r.phone,
    purpose: "followup",
    body: `${r.name}, ${r.doctor.name}-এর সাথে আপনার ফলোআপ বাকি আছে। সিরিয়াল নিন: ${process.env.APP_URL ?? ""}/dr/${r.doctor.slug}`,
  });
  await db.update(schema.followUps).set({ remindedAt: new Date() }).where(eq(schema.followUps.id, r.fu.id));
  revalidatePath("/dashboard/followups");
}

export async function closeFollowUp(fd: FormData) {
  const s = await requireStaff();
  await db.update(schema.followUps).set({ status: "CANCELLED" })
    .where(and(eq(schema.followUps.id, str(fd, "id")), eq(schema.followUps.doctorId, s.doctorId)));
  revalidatePath("/dashboard/followups");
}
