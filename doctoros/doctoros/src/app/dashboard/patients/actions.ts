"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { BookingError, createBooking } from "@/lib/booking";
import { assertChamber } from "@/lib/chambers";
import { type FormState, int, str } from "@/lib/form";
import { bn, today } from "@/lib/time";

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
      birthYear: age && age > 0 && age < 120 ? new Date().getFullYear() - age : null,
    });
    revalidatePath("/dashboard/queue");
    return { ok: `${patient.name} — সিরিয়াল ${bn(booking.serialNo)} (${booking.code})` };
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
}
