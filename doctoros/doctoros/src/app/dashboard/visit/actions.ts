"use server";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import type { Medicine } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { type FormState, str } from "@/lib/form";
import { advanceQueue } from "@/lib/queue";
import { addDays, today } from "@/lib/time";

export async function savePrescription(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requireStaff();
  const bookingId = str(fd, "bookingId");
  const [b] = await db.select().from(schema.bookings).where(and(eq(schema.bookings.id, bookingId), eq(schema.bookings.doctorId, s.doctorId))).limit(1);
  if (!b) return { error: "সিরিয়াল পাওয়া যায়নি" };

  const names = fd.getAll("med-name").map(String);
  const doses = fd.getAll("med-dose").map(String);
  const whens = fd.getAll("med-when").map(String);
  const dayss = fd.getAll("med-days").map(String);
  const medicines: Medicine[] = names
    .map((name, i) => ({ name: name.trim(), dose: (doses[i] ?? "").trim(), when: (whens[i] ?? "").trim(), days: (dayss[i] ?? "").trim() }))
    .filter((m) => m.name);

  // ফলোআপ: "৭ দিন পর" বা নির্দিষ্ট তারিখ
  const fuChoice = str(fd, "followUp");
  let followUpDate: string | null = null;
  if (fuChoice === "date") followUpDate = str(fd, "followUpDate") || null;
  else if (/^\d+$/.test(fuChoice)) followUpDate = addDays(today(), Number(fuChoice));
  if (followUpDate && followUpDate <= today()) return { error: "ফলোআপের তারিখ আজকের পরে হতে হবে" };

  const values = {
    complaint: str(fd, "complaint") || null,
    diagnosis: str(fd, "diagnosis") || null,
    advice: str(fd, "advice") || null,
    medicines,
    followUpDate,
  };

  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(schema.visits).where(eq(schema.visits.bookingId, b.id)).limit(1);
    const visit = existing
      ? (await tx.update(schema.visits).set(values).where(eq(schema.visits.id, existing.id)).returning())[0]
      : (await tx.insert(schema.visits).values({ ...values, bookingId: b.id, doctorId: b.doctorId, patientId: b.patientId }).returning())[0];

    if (followUpDate) {
      await tx
        .insert(schema.followUps)
        .values({ doctorId: b.doctorId, patientId: b.patientId, visitId: visit.id, dueDate: followUpDate })
        .onConflictDoUpdate({ target: schema.followUps.visitId, set: { dueDate: followUpDate, status: "PENDING", remindedAt: null } });
    } else {
      await tx.delete(schema.followUps).where(and(eq(schema.followUps.visitId, visit.id), ne(schema.followUps.status, "BOOKED")));
    }
  });

  if (fd.get("next") === "1") {
    if (b.status === "IN_PROGRESS") await advanceQueue(b.chamberId, b.date, "done");
    revalidatePath("/dashboard/queue");
    redirect(`/dashboard/queue?chamber=${b.chamberId}`);
  }
  revalidatePath(`/dashboard/visit/${b.id}`);
  return { ok: "প্রেসক্রিপশন সেভ হয়েছে" };
}
