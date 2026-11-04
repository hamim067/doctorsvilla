"use server";
import { revalidatePath } from "next/cache";
import type { VState } from "@/components/Vitals";
import { db, schema } from "@/db";
import { doctorHasPatient } from "@/lib/access";
import { parseVital } from "@/lib/vitals";
import { requireStaff } from "@/lib/auth";
import { BookingError, createBooking } from "@/lib/booking";
import { assertChamber } from "@/lib/chambers";
import { type FormState, int, str } from "@/lib/form";
import { bn, today, thisYear } from "@/lib/time";

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
  await db.insert(schema.vitals).values({ ...r.value, patientId, doctorId: s.doctorId, source: s.role === "ASSISTANT" ? "ASSISTANT" : "DOCTOR" });
  revalidatePath("/dashboard", "layout");
  return { ok: "রিডিং সেভ হয়েছে — রোগীর নিজের ফাইলেও দেখাবে", at: Date.now() };
}
