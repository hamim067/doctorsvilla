"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireDoctor } from "@/lib/auth";
import { assertChamber } from "@/lib/chambers";
import { type FormState, int, str } from "@/lib/form";
import { notifyPatient } from "@/lib/notify";
import { getQueue } from "@/lib/queue";
import { formatDateBn, today } from "@/lib/time";

const chamberSchema = z.object({
  name: z.string().min(2, "চেম্বারের নাম দিন"),
  code: z.string().regex(/^[A-Z]{2,5}$/, "চেম্বার কোড: ২–৫টি ইংরেজি বড় হাতের অক্ষর (যেমন RAJ)"),
  address: z.string().min(3, "ঠিকানা দিন"),
  city: z.string().min(2, "শহর দিন"),
  feeNew: z.number({ message: "নতুন রোগীর ফি দিন" }).int().min(0),
  feeFollowUp: z.number({ message: "ফলোআপ ফি দিন" }).int().min(0),
  avgMinutes: z.number().int().min(1).max(120),
  dailyLimit: z.number().int().min(1).max(500),
  onlineSharePct: z.number().int().min(0).max(100),
});

function readChamber(fd: FormData) {
  return chamberSchema.safeParse({
    name: str(fd, "name"),
    code: str(fd, "code").toUpperCase(),
    address: str(fd, "address"),
    city: str(fd, "city"),
    feeNew: int(fd, "feeNew") ?? undefined,
    feeFollowUp: int(fd, "feeFollowUp") ?? undefined,
    avgMinutes: int(fd, "avgMinutes") ?? 10,
    dailyLimit: int(fd, "dailyLimit") ?? 30,
    onlineSharePct: int(fd, "onlineSharePct") ?? 60,
  });
}

/** ফর্মের ৭ দিনের সময়সূচি পড়া: open-0..6, start-0..6, end-0..6 */
function readSchedule(fd: FormData) {
  const out: { weekday: number; startTime: string; endTime: string }[] = [];
  for (let d = 0; d < 7; d++) {
    if (fd.get(`open-${d}`) !== "on") continue;
    const startTime = str(fd, `start-${d}`);
    const endTime = str(fd, `end-${d}`);
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || endTime <= startTime)
      return { error: "প্রতিটি খোলা দিনের শুরু ও শেষের সময় ঠিক করে দিন" } as const;
    out.push({ weekday: d, startTime, endTime });
  }
  if (out.length === 0) return { error: "অন্তত একটি দিন খোলা রাখুন" } as const;
  return { rows: out } as const;
}

export async function createChamber(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requireDoctor();
  const parsed = readChamber(fd);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const sch = readSchedule(fd);
  if ("error" in sch) return { error: sch.error };
  const [dup] = await db
    .select({ id: schema.chambers.id })
    .from(schema.chambers)
    .where(and(eq(schema.chambers.doctorId, s.doctorId), eq(schema.chambers.code, parsed.data.code)))
    .limit(1);
  if (dup) return { error: "এই কোডের চেম্বার আগেই আছে" };

  const id = await db.transaction(async (tx) => {
    const [c] = await tx.insert(schema.chambers).values({ ...parsed.data, doctorId: s.doctorId }).returning();
    await tx.insert(schema.schedules).values(sch.rows.map((r) => ({ ...r, chamberId: c.id })));
    return c.id;
  });
  revalidatePath("/dashboard");
  redirect(`/dashboard/chambers/${id}?saved=1`);
}

export async function updateChamber(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requireDoctor();
  const id = str(fd, "id");
  await assertChamber(s.doctorId, id);
  const parsed = readChamber(fd);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const sch = readSchedule(fd);
  if ("error" in sch) return { error: sch.error };
  try {
    await db.transaction(async (tx) => {
      await tx.update(schema.chambers).set(parsed.data).where(eq(schema.chambers.id, id));
      await tx.delete(schema.schedules).where(eq(schema.schedules.chamberId, id));
      await tx.insert(schema.schedules).values(sch.rows.map((r) => ({ ...r, chamberId: id })));
    });
  } catch {
    return { error: "সেভ করা যায়নি — চেম্বার কোড হয়তো আরেকটি চেম্বারে আছে" };
  }
  revalidatePath(`/dashboard/chambers/${id}`);
  return { ok: "সেভ হয়েছে" };
}

/** ছুটি যোগ — ওই দিনের বুক করা রোগীদের স্বয়ংক্রিয় এসএমএস */
export async function addHoliday(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requireDoctor();
  const chamberId = str(fd, "chamberId");
  const chamber = await assertChamber(s.doctorId, chamberId);
  const date = str(fd, "date");
  const note = str(fd, "note") || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today()) return { error: "আজ বা পরের কোনো তারিখ দিন" };
  await db.insert(schema.holidays).values({ chamberId, date, note }).onConflictDoNothing();

  const booked = (await getQueue(chamberId, date)).filter((r) => r.status === "WAITING");
  for (const b of booked) {
    await notifyPatient({
      doctorId: s.doctorId,
      phone: b.phone,
      purpose: "holiday",
      body: `দুঃখিত, ${formatDateBn(date)} ${chamber.name} বন্ধ থাকবে। আপনার সিরিয়াল (${b.code}) বাতিল হয়েছে, অনুগ্রহ করে নতুন সিরিয়াল নিন।`,
    });
    await db.update(schema.bookings).set({ status: "CANCELLED" }).where(eq(schema.bookings.id, b.id));
  }
  revalidatePath(`/dashboard/chambers/${chamberId}`);
  return { ok: booked.length ? `ছুটি যোগ হয়েছে · ${booked.length} জন রোগীকে জানানো হয়েছে` : "ছুটি যোগ হয়েছে" };
}

export async function removeHoliday(fd: FormData) {
  const s = await requireDoctor();
  const chamberId = str(fd, "chamberId");
  await assertChamber(s.doctorId, chamberId);
  await db.delete(schema.holidays).where(and(eq(schema.holidays.id, str(fd, "id")), eq(schema.holidays.chamberId, chamberId)));
  revalidatePath(`/dashboard/chambers/${chamberId}`);
}
