"use server";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import type { Medicine } from "@/db/schema";
import { canSeeRx } from "@/lib/access";
import { requireStaff } from "@/lib/auth";
import { type FormState, str } from "@/lib/form";
import { advanceQueue } from "@/lib/queue";
import { addDays, today } from "@/lib/time";
import { parseVital } from "@/lib/vitals";

/** প্রেসক্রিপশন DB-তে রাখা — হাতে সেভ আর অটো-সেভ দুটোই এটা ব্যবহার করে */
async function persist(doctorId: string, fd: FormData, auto: boolean, staffRole = "DOCTOR") {
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

  // আজকের মাপ (প্রেসার, পালস, ওজন, তাপ, SpO₂, সুগার) — একই দিনের এই ডাক্তারের রিডিং থাকলে সেটাই বদলাই, নতুন সারি নয়
  const bp = str(fd, "v-bp").replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
  const vf = new FormData();
  const [sys, dia] = bp.split(/[\/\s-]+/).filter(Boolean);
  if (sys) vf.set("systolic", sys);
  if (dia) vf.set("diastolic", dia);
  for (const k of ["pulse", "weight", "temp", "spo2", "sugar"]) { const x = str(fd, `v-${k}`); if (x) vf.set(k, x); }
  vf.set("date", b.date);
  const anyVital = [...vf.keys()].some((k) => k !== "date");
  let vitalValue: Exclude<ReturnType<typeof parseVital>, { error: string }>["value"] | null = null;
  if (anyVital) {
    const pv = parseVital(vf);
    if ("error" in pv) { if (!auto) return { error: `মাপ: ${pv.error}` } as const; }
    else vitalValue = pv.value;
  }

  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(schema.visits).where(eq(schema.visits.bookingId, b.id)).limit(1);
    const visit = existing
      ? (await tx.update(schema.visits).set(values).where(eq(schema.visits.id, existing.id)).returning())[0]
      : (await tx.insert(schema.visits).values({ ...values, bookingId: b.id, doctorId: b.doctorId, patientId: b.patientId }).returning())[0];

    if (vitalValue) {
      const [old] = await tx.select({ id: schema.vitals.id }).from(schema.vitals)
        .where(and(eq(schema.vitals.patientId, b.patientId), eq(schema.vitals.doctorId, b.doctorId), eq(schema.vitals.date, b.date), ne(schema.vitals.source, "PATIENT"))).limit(1);
      if (old) await tx.update(schema.vitals).set(vitalValue).where(eq(schema.vitals.id, old.id));
      else await tx.insert(schema.vitals).values({ ...vitalValue, patientId: b.patientId, doctorId: b.doctorId, source: staffRole === "ASSISTANT" ? "ASSISTANT" : "DOCTOR" });
    }

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
  const r = await persist(s.doctorId, fd, false, s.role);
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
  const filled = ["complaint", "diagnosis", "advice", "investigations", "v-bp", "v-pulse", "v-weight", "v-temp", "v-spo2", "v-sugar"].some((k) => str(fd, k)) || fd.getAll("med-name").some((v) => String(v).trim());
  if (!filled) return { ok: true };
  let r;
  try { r = await persist(s.doctorId, fd, true, s.role); } catch { return { ok: false, error: "সেভ করা যায়নি" }; }
  if ("error" in r) return { ok: false, error: r.error };
  return { ok: true, at: new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit" }).format(new Date()) };
}

/** টেমপ্লেট সেভ — একই নামে থাকলে বদলে দেয় */
const tplSchema = z.object({
  name: z.string().trim().min(1).max(40),
  data: z.object({
    complaint: z.string().max(500), diagnosis: z.string().max(300), advice: z.string().max(2000), investigations: z.string().max(1000), followUp: z.string().max(10),
    medicines: z.array(z.object({ name: z.string().max(120), dose: z.string().max(40), when: z.string().max(60), days: z.string().max(40) })).max(30),
  }),
});
export async function saveRxTemplate(raw: unknown): Promise<{ ok?: true; error?: string; id?: string }> {
  const s = await requireStaff();
  if (!(await canSeeRx(s))) return { error: "অনুমতি নেই" };
  const r = tplSchema.safeParse(raw);
  if (!r.success) return { error: "টেমপ্লেটের নাম দিন (৪০ অক্ষরের মধ্যে)" };
  const data = { ...r.data.data, medicines: r.data.data.medicines.filter((m) => m.name.trim()) };
  const [row] = await db.insert(schema.rxTemplates).values({ doctorId: s.doctorId, name: r.data.name, data })
    .onConflictDoUpdate({ target: [schema.rxTemplates.doctorId, schema.rxTemplates.name], set: { data } }).returning({ id: schema.rxTemplates.id });
  return { ok: true, id: row.id };
}
export async function deleteRxTemplate(id: string) {
  const s = await requireStaff();
  if (!(await canSeeRx(s))) return;
  await db.delete(schema.rxTemplates).where(and(eq(schema.rxTemplates.id, id), eq(schema.rxTemplates.doctorId, s.doctorId)));
}
