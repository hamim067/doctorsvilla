"use server";
import { revalidatePath } from "next/cache";
import type { VState } from "@/components/Vitals";
import { db, schema } from "@/db";
import { and, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { canSeeRx, doctorHasPatient } from "@/lib/access";
import { splitList } from "@/lib/meds";
import { duplicateVital, parseVital } from "@/lib/vitals";
import { requireStaff } from "@/lib/auth";
import { BookingError, createBooking } from "@/lib/booking";
import { assertChamber } from "@/lib/chambers";
import { type FormState, int, str } from "@/lib/form";
import { bn, formatDateBn, today, thisYear } from "@/lib/time";

/** সরাসরি আসা রোগী — নতুন হোক বা চেনা, একই লাইনে সিরিয়াল */
export async function addWalkIn(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requireStaff();
  const chamberId = str(fd, "chamberId");
  await assertChamber(s.doctorId, chamberId);
  const age = int(fd, "age");
  try {
    const { booking, patient } = await createBooking({
      chamberId,
      date: today(),
      source: "WALK_IN",
      patientId: str(fd, "patientId") || undefined,
      phone: str(fd, "phone"),
      name: str(fd, "name"),
      gender: str(fd, "gender") || null,
      birthYear: age && age > 0 && age < 120 ? thisYear() - age : null,
    });
    revalidatePath("/dashboard/queue");
    return { ok: `${patient.name} — সিরিয়াল ${bn(booking.serialNo)} (${booking.code})` };
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
}

/** ডাক্তার/অ্যাসিস্ট্যান্ট রোগীর প্রেসার, সুগার, ওজন যোগ করেন — শুধু নিজের রোগীর */
export async function addVitalForPatient(patientId: string, _: VState, fd: FormData): Promise<VState> {
  const s = await requireStaff();
  if (!(await doctorHasPatient(s.doctorId, patientId))) return { error: "এই রোগী আপনার তালিকায় নেই" };
  const r = parseVital(fd);
  if ("error" in r) return { error: r.error };
  if (await duplicateVital(patientId, r.value)) return { error: "এই রিডিং আগেই সেভ করা আছে" };
  await db.insert(schema.vitals).values({ ...r.value, patientId, doctorId: s.doctorId, source: s.role === "ASSISTANT" ? "ASSISTANT" : "DOCTOR" });
  revalidatePath("/dashboard", "layout");
  return { ok: "রিডিং সেভ হয়েছে — রোগীর নিজের ফাইলেও দেখাবে", at: Date.now() };
}

export type QState = { error?: string; ok?: string; at?: number } | undefined;

/**
 * রোগীর কার্ডের তিনটা বড় বোতাম:
 *  today       — আজকের সিরিয়ালে যোগ
 *  direct      — এখনই প্রেসক্রিপশন (সিরিয়াল ছাড়া; ভিজিট সম্পন্ন হিসেবে থাকে, আয়ে গোনা হয় — চাইলে ফ্রি)
 *  appointment — পরের কোনো দিনের অ্যাপয়েন্টমেন্ট (সরাসরি রোগীর কোটায়, অনলাইনের সিরিয়াল কমায় না)
 */
export async function quickBook(patientId: string, _: QState, fd: FormData): Promise<QState> {
  const s = await requireStaff();
  if (!(await doctorHasPatient(s.doctorId, patientId))) return { error: "এই রোগী আপনার তালিকায় নেই" };
  const mode = str(fd, "mode");
  const chamberId = str(fd, "chamberId");
  try { await assertChamber(s.doctorId, chamberId); } catch { return { error: "চেম্বার বেছে নিন" }; }
  const t = today();
  let date = t;
  if (mode === "appointment") {
    date = str(fd, "date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "তারিখ বেছে নিন" };
    if (date <= t) return { error: "অ্যাপয়েন্টমেন্টের তারিখ আজকের পরে দিন — আজকের জন্য \"আজকের সিরিয়ালে যোগ\" চাপুন" };
  }
  if (mode === "direct" && !(await canSeeRx(s))) return { error: "প্রেসক্রিপশনের অনুমতি নেই" };
  if (mode === "direct") {
    // আজ এই চেম্বারে রোগীর সিরিয়াল আগে থেকেই থাকলে নতুন বানাই না — সেটারই প্রেসক্রিপশন খুলি (তথ্য দুবার হয় না)
    const [have] = await db.select({ id: schema.bookings.id }).from(schema.bookings).where(and(
      eq(schema.bookings.patientId, patientId), eq(schema.bookings.chamberId, chamberId),
      eq(schema.bookings.date, t), ne(schema.bookings.status, "CANCELLED"))).limit(1);
    if (have) {
      if (fd.get("free") === "1") await db.update(schema.bookings).set({ feeWaived: true }).where(eq(schema.bookings.id, have.id));
      redirect(`/dashboard/visit/${have.id}`);
    }
  }
  let bookingId: string;
  try {
    const { booking } = await createBooking({
      chamberId, date, source: "WALK_IN", patientId,
      direct: mode === "direct", feeWaived: mode === "direct" && fd.get("free") === "1",
    });
    bookingId = booking.id;
    revalidatePath("/dashboard", "layout");
    if (mode === "today") return { ok: `আজকের সিরিয়াল ${bn(booking.serialNo)} (${booking.code}) দেওয়া হয়েছে`, at: Date.now() };
    if (mode === "appointment") return { ok: `${formatDateBn(date)} — সিরিয়াল ${bn(booking.serialNo)} (${booking.code}) দেওয়া হয়েছে। রোগী নিজের অ্যাকাউন্টে দেখতে পাবেন।`, at: Date.now() };
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
  redirect(`/dashboard/visit/${bookingId}`);
}

/** অ্যালার্জি ও দীর্ঘমেয়াদি রোগ — একই জিনিস দুবার লেখা হয় না */
export async function saveHealthInfo(patientId: string, _: QState, fd: FormData): Promise<QState> {
  const s = await requireStaff();
  if (!(await doctorHasPatient(s.doctorId, patientId))) return { error: "এই রোগী আপনার তালিকায় নেই" };
  const allergies = splitList(str(fd, "allergies")).join(", ").slice(0, 300) || null;
  const conditions = splitList(str(fd, "conditions")).join(", ").slice(0, 300) || null;
  await db.update(schema.patients).set({ allergies, conditions }).where(eq(schema.patients.id, patientId));
  revalidatePath("/dashboard", "layout");
  return { ok: "সেভ হয়েছে", at: Date.now() };
}
