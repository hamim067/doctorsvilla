"use server";
import { and, eq } from "drizzle-orm";
import { thisYear } from "@/lib/time";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { BookingError, createBooking, normalizePhone } from "@/lib/booking";
import { clientIp, hit } from "@/lib/rate-limit";
import { type FormState, int, str } from "@/lib/form";
import { getPatientSession } from "@/lib/patient-auth";

export async function bookOnline(_: FormState, fd: FormData): Promise<FormState> {
  const age = int(fd, "age");
  // লগইন করা রোগী পরিবারের কোনো সদস্য বেছে নিলে — সদস্যটা তার নিজের কিনা যাচাই
  let patientId: string | undefined;
  const wanted = str(fd, "patientId");
  if (wanted && wanted !== "new") {
    const s = await getPatientSession();
    if (!s) return { error: "আবার লগইন করুন" };
    const [p] = await db.select({ id: schema.patients.id }).from(schema.patients)
      .where(and(eq(schema.patients.id, wanted), eq(schema.patients.accountId, s.accountId))).limit(1);
    if (!p) return { error: "সদস্য পাওয়া যায়নি" };
    patientId = p.id;
  }
  // ভুয়া বুকিং দিয়ে সিরিয়াল ভরিয়ে ফেলা ঠেকাতে: এক জায়গা থেকে ঘণ্টায় ১০টা, এক নাম্বারে দিনে ৬টা
  const phoneKey = normalizePhone(str(fd, "phone")) ?? "";
  if (!(await hit(`book-ip:${await clientIp()}`, 10, 3600)) || (phoneKey && !(await hit(`book-ph:${phoneKey}`, 6, 86400))))
    return { error: "অনেকগুলো সিরিয়াল নেওয়া হয়েছে — কিছুক্ষণ পরে আবার চেষ্টা করুন, বা চেম্বারে ফোন করুন" };
  let id: string;
  try {
    const { booking } = await createBooking({
      chamberId: str(fd, "chamberId"),
      date: str(fd, "date"),
      source: "ONLINE",
      patientId,
      phone: str(fd, "phone"),
      name: str(fd, "name"),
      gender: str(fd, "gender") || null,
      birthYear: age && age > 0 && age < 120 ? thisYear() - age : null,
    });
    id = booking.id;
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    console.error(e);
    return { error: "সিরিয়াল নেওয়া যায়নি, আবার চেষ্টা করুন" };
  }
  redirect(`/live/${id}?new=1`);
}
