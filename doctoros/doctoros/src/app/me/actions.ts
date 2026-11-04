"use server";
import { and, eq, gte, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { normalizePhone } from "@/lib/booking";
import { type FormState, int, str } from "@/lib/form";
import { createPatientSession, destroyPatientSession, familyOf, requirePatient, sendOtp, verifyOtp } from "@/lib/patient-auth";
import { today, thisYear } from "@/lib/time";
import type { VState } from "@/components/Vitals";
import { duplicateVital, parseVital } from "@/lib/vitals";
import { cookies } from "next/headers";
import { splitList } from "@/lib/meds";
import { MEMBER_COOKIE } from "@/lib/patient-auth";

export type OtpState = { step: "phone" | "code"; phone?: string; error?: string; demoCode?: string; info?: string } | undefined;

export async function otpAction(prev: OtpState, fd: FormData): Promise<OtpState> {
  const intent = str(fd, "intent");
  if (intent === "send" || intent === "resend") {
    const phone = normalizePhone(str(fd, "phone") || prev?.phone || "");
    if (!phone) return { step: "phone", error: "সঠিক মোবাইল নাম্বার দিন (যেমন 01712345678)" };
    const r = await sendOtp(phone);
    if (r.error) return { step: prev?.step === "code" ? "code" : "phone", phone, error: r.error, demoCode: prev?.demoCode };
    return { step: "code", phone, demoCode: r.demoCode, info: `${phone} নাম্বারে ৬ সংখ্যার কোড পাঠানো হয়েছে` };
  }
  const phone = prev?.phone;
  if (!phone) return { step: "phone", error: "আগে মোবাইল নাম্বার দিন" };
  const code = str(fd, "code").replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/\D/g, "");
  if (code.length !== 6) return { ...prev, step: "code", error: "৬ সংখ্যার কোডটা দিন", info: undefined };
  const r = await verifyOtp(phone, code);
  if (r.error || !r.accountId) return { ...prev, step: "code", error: r.error, info: undefined };
  await createPatientSession({ accountId: r.accountId, phone });
  const next = str(fd, "next");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/me");
}

export async function patientLogout() {
  await destroyPatientSession();
  redirect("/");
}

export async function addFamilyMember(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requirePatient();
  const name = str(fd, "name");
  if (name.length < 2) return { error: "সদস্যের নাম দিন" };
  const age = int(fd, "age");
  const fam = await familyOf(s.accountId);
  if (fam.some((p) => p.name.trim().toLowerCase() === name.toLowerCase())) return { error: "এই নামে আগেই একজন সদস্য আছেন" };
  if (fam.length >= 15) return { error: "একটি নাম্বারে সর্বোচ্চ ১৫ জন সদস্য রাখা যায়" };
  await db.insert(schema.patients).values({
    accountId: s.accountId,
    name,
    relation: str(fd, "relation") || (fam.length === 0 ? "নিজে" : null),
    gender: str(fd, "gender") || null,
    birthYear: age && age > 0 && age < 120 ? thisYear() - age : null,
  });
  const [created] = await db.select({ id: schema.patients.id }).from(schema.patients)
    .where(and(eq(schema.patients.accountId, s.accountId), eq(schema.patients.name, name))).limit(1);
  if (created) (await cookies()).set(MEMBER_COOKIE, created.id, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/me", "layout");
  return { ok: `${name} যোগ হয়েছেন` };
}

export async function updateRelation(fd: FormData) {
  const s = await requirePatient();
  await db.update(schema.patients).set({ relation: str(fd, "relation") || null })
    .where(and(eq(schema.patients.id, str(fd, "id")), eq(schema.patients.accountId, s.accountId)));
  revalidatePath("/me/family");
}

/** আসন্ন সিরিয়াল বাতিল — শুধু নিজের পরিবারের, আর ডাক পড়ার আগে */
export async function cancelBooking(fd: FormData) {
  const s = await requirePatient();
  const ids = (await familyOf(s.accountId)).map((p) => p.id);
  if (ids.length === 0) return;
  await db.update(schema.bookings).set({ status: "CANCELLED" }).where(and(
    eq(schema.bookings.id, str(fd, "id")),
    inArray(schema.bookings.patientId, ids),
    eq(schema.bookings.status, "WAITING"),
    gte(schema.bookings.date, today()),
  ));
  revalidatePath("/me");
}

/** রোগী নিজে (বা পরিবারের সদস্যের) প্রেসার/সুগার/ওজন লেখেন */
export async function addMyVital(patientId: string, _: VState, fd: FormData): Promise<VState> {
  const s = await requirePatient();
  const fam = await familyOf(s.accountId);
  if (!fam.some((p) => p.id === patientId)) return { error: "সদস্য পাওয়া যায়নি" };
  const r = parseVital(fd);
  if ("error" in r) return { error: r.error };
  if (await duplicateVital(patientId, r.value)) return { error: "এই রিডিং আগেই সেভ করা আছে" };
  await db.insert(schema.vitals).values({ ...r.value, patientId, doctorId: null, source: "PATIENT" });
  revalidatePath("/me/health");
  revalidatePath("/me");
  return { ok: "রিডিং সেভ হয়েছে — আপনার ডাক্তারও পরের ভিজিটে দেখতে পাবেন", at: Date.now() };
}

/** কার তথ্য দেখছেন — মেনু থেকে সদস্য বাছাই (কুকিতে মনে রাখে) */
export async function selectMember(fd: FormData) {
  const s = await requirePatient();
  const id = str(fd, "id");
  const fam = await familyOf(s.accountId);
  if (fam.some((p) => p.id === id)) (await cookies()).set(MEMBER_COOKIE, id, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/me", "layout");
}

/** সদস্যের তথ্য বদলানো — নাম, সম্পর্ক, বয়স, লিঙ্গ, অ্যালার্জি, দীর্ঘমেয়াদি রোগ */
export async function updateMember(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requirePatient();
  const id = str(fd, "id");
  const fam = await familyOf(s.accountId);
  const me = fam.find((p) => p.id === id);
  if (!me) return { error: "সদস্য পাওয়া যায়নি" };
  const name = str(fd, "name");
  if (name.length < 2) return { error: "নাম দিন" };
  if (fam.some((p) => p.id !== id && p.name.trim().toLowerCase() === name.toLowerCase())) return { error: "এই নামে আরেকজন সদস্য আছেন" };
  const age = int(fd, "age");
  await db.update(schema.patients).set({
    name,
    relation: str(fd, "relation") || null,
    gender: str(fd, "gender") || null,
    birthYear: age && age > 0 && age < 120 ? thisYear() - age : me.birthYear,
    allergies: splitList(str(fd, "allergies")).join(", ").slice(0, 300) || null,
    conditions: splitList(str(fd, "conditions")).join(", ").slice(0, 300) || null,
  }).where(and(eq(schema.patients.id, id), eq(schema.patients.accountId, s.accountId)));
  revalidatePath("/me", "layout");
  return { ok: "সেভ হয়েছে" };
}
