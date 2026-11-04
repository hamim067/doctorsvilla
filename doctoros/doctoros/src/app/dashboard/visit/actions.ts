"use server";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import type { Medicine } from "@/db/schema";
import { canSeeRx } from "@/lib/access";
import { requireStaff } from "@/lib/auth";
import { type FormState, str } from "@/lib/form";
import { advanceQueue } from "@/lib/queue";
import { addDays, today } from "@/lib/time";

/** প্রেসক্রিপশন DB-তে রাখা — হাতে সেভ আর অটো-সেভ দুটোই এটা ব্যবহার করে */
async function persist(doctorId: string, fd: FormData, auto: boolean) {
  const bookingId = str(fd, "bookingId");
  const [b] = await db.select().from(schema.bookings).where(and(eq(schema.bookings.id, bookingId), eq(schema.bookings.doctorId, doctorId))).limit(1);
  if (!b) return { error: "সিরিয়াল পাওয়া যায়নি" } as const;

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
  if (followUpDate && followUpDate <= today()) {
    if (!auto) return { error: "ফলোআপের তারিখ আজকের পরে হতে হবে" } as const;
    followUpDate = null; // অটো-সেভে ভুল তারিখ বাদ দিয়ে বাকিটা রাখি
  }

  const values = {
    complaint: str(fd, "complaint") || null,
    diagnosis: str(fd, "diagnosis") || null,
    advice: str(fd, "advice") || null,
    investigations: str(fd, "investigations") || null,
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
        .onConflictDoUpdate({ target: schema.followUps.visitId, set: { dueDate: followUpDate, status: "PENDING", remindedAt: null }, setWhere: ne(schema.followUps.dueDate, followUpDate) });
    } else {
      await tx.delete(schema.followUps).where(and(eq(schema.followUps.visitId, visit.id), ne(schema.followUps.status, "BOOKED")));
    }
  });

  return { b } as const;
}

export async function savePrescription(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requireStaff();
  if (!(await canSeeRx(s))) return { error: "প্রেসক্রিপশনের অনুমতি নেই" };
  const r = await persist(s.doctorId, fd, false);
  if ("error" in r) return { error: r.error };
  const { b } = r;
  if (fd.get("next") === "print") redirect(`/print/rx/${b.id}?auto=1`);
  if (fd.get("next") === "1") {
    if (b.status === "IN_PROGRESS") await advanceQueue(b.chamberId, b.date, "done");
    revalidatePath("/dashboard/queue");
    redirect(`/dashboard/queue?chamber=${b.chamberId}`);
  }
  revalidatePath(`/dashboard/visit/${b.id}`);
  return { ok: "প্রেসক্রিপশন সেভ হয়েছে" };
}

/**
 * অটো-সেভ — ডাক্তার লিখতে লিখতেই প্রেসক্রিপশন জমা হয়।
 * সেভ না চেপে শুধু প্রিন্ট করলে বা পেজ ছেড়ে গেলেও তথ্য হারায় না,
 * আর রোগীর নিজের অ্যাকাউন্টেও চলে যায়। পুরো খালি ফর্ম হলে কিছু রাখে না।
 */
export async function autosavePrescription(fd: FormData): Promise<{ ok: boolean; at?: string; error?: string }> {
  const s = await requireStaff();
  if (!(await canSeeRx(s))) return { ok: false, error: "অনুমতি নেই" };
  const filled = ["complaint", "diagnosis", "advice", "investigations"].some((k) => str(fd, k)) || fd.getAll("med-name").some((v) => String(v).trim());
  if (!filled) return { ok: true };
  let r;
  try { r = await persist(s.doctorId, fd, true); } catch { return { ok: false, error: "সেভ করা যায়নি" }; }
  if ("error" in r) return { ok: false, error: r.error };
  return { ok: true, at: new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit" }).format(new Date()) };
}
