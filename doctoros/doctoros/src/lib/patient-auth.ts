import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { notifyPatient } from "@/lib/notify";

/**
 * রোগীর লগইন — মোবাইল নাম্বারে ৬ সংখ্যার OTP।
 * - কোড ৫ মিনিট কাজ করে, ভুল দেওয়া যায় সর্বোচ্চ ৫ বার
 * - এক নাম্বারে ঘণ্টায় সর্বোচ্চ ৫টা কোড, পরপর দুটোর মাঝে অন্তত ৬০ সেকেন্ড
 * - SMS_PROVIDER "http" না হলে (ডেমো/টেস্ট) কোডটা স্ক্রিনেই দেখানো হয়
 */
const COOKIE = "dos_patient";
const MAX_AGE = 60 * 60 * 24 * 60; // ৬০ দিন
const OTP_TTL_MS = 5 * 60 * 1000;

export type PatientSession = { typ: "patient"; accountId: string; phone: string };

function key() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET কমপক্ষে ৩২ অক্ষরের হতে হবে");
  return new TextEncoder().encode(s);
}

const hashCode = (phone: string, code: string) =>
  createHash("sha256").update(`${process.env.SESSION_SECRET}:${phone}:${code}`).digest("hex");

export const smsIsLive = () => process.env.SMS_PROVIDER === "http";

/**
 * এসএমএস চালু না থাকলে কোড স্ক্রিনে দেখানো হয় — কিন্তু শুধু ডেমো রোগীর নম্বরে (01800000001–09),
 * নইলে যে কেউ অন্যের নম্বর দিয়ে তার প্রেসক্রিপশন দেখে ফেলতে পারত।
 * টেস্টের জন্য সব নম্বরে দেখাতে চাইলে Vercel-এ OTP_DEMO_ALL=1 (আসল রোগী আসার আগে মুছে দিন)।
 */
const isDemoPhone = (p: string) => /^0180000000\d$/.test(p);
const showOnScreen = (p: string) => !smsIsLive() && (isDemoPhone(p) || process.env.OTP_DEMO_ALL === "1");

export async function sendOtp(phone: string): Promise<{ error?: string; demoCode?: string }> {
  if (!smsIsLive() && !showOnScreen(phone)) {
    return { error: "রোগীর লগইন শীঘ্রই চালু হচ্ছে (এসএমএস যুক্ত হলে)। সিরিয়াল নিতে লগইন লাগে না — ডাক্তারের পেজ থেকে সরাসরি নিন।" };
  }
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await db
    .select({ createdAt: schema.otpCodes.createdAt })
    .from(schema.otpCodes)
    .where(and(eq(schema.otpCodes.phone, phone), gte(schema.otpCodes.createdAt, hourAgo)))
    .orderBy(desc(schema.otpCodes.createdAt));
  if (recent.length >= 5) return { error: "অনেকবার কোড চাওয়া হয়েছে — এক ঘণ্টা পরে আবার চেষ্টা করুন" };
  if (recent[0] && Date.now() - recent[0].createdAt.getTime() < 60 * 1000) return { error: "এক মিনিট পরে আবার কোড চাইতে পারবেন" };

  const code = String(randomInt(100000, 1000000));
  await db.insert(schema.otpCodes).values({ phone, codeHash: hashCode(phone, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) });
  await notifyPatient({ doctorId: null, phone, purpose: "otp", body: `DoctorOS লগইন কোড: ${code}। ৫ মিনিট কাজ করবে, কাউকে বলবেন না।` });
  return showOnScreen(phone) ? { demoCode: code } : {};
}

export async function verifyOtp(phone: string, code: string): Promise<{ error?: string; accountId?: string }> {
  const [otp] = await db
    .select()
    .from(schema.otpCodes)
    .where(and(eq(schema.otpCodes.phone, phone), isNull(schema.otpCodes.usedAt)))
    .orderBy(desc(schema.otpCodes.createdAt))
    .limit(1);
  if (!otp || otp.expiresAt.getTime() < Date.now()) return { error: "কোডের মেয়াদ শেষ — নতুন কোড চান" };
  if (otp.attempts >= 5) return { error: "অনেকবার ভুল হয়েছে — নতুন কোড চান" };

  const a = Buffer.from(otp.codeHash, "hex");
  const b = Buffer.from(hashCode(phone, code), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await db.update(schema.otpCodes).set({ attempts: otp.attempts + 1 }).where(eq(schema.otpCodes.id, otp.id));
    return { error: `কোড মেলেনি — আর ${4 - otp.attempts} বার চেষ্টা করতে পারবেন` };
  }
  await db.update(schema.otpCodes).set({ usedAt: new Date() }).where(eq(schema.otpCodes.id, otp.id));
  await db.insert(schema.patientAccounts).values({ phone }).onConflictDoNothing();
  const [acc] = await db.select().from(schema.patientAccounts).where(eq(schema.patientAccounts.phone, phone)).limit(1);
  return { accountId: acc.id };
}

export async function createPatientSession(s: Omit<PatientSession, "typ">) {
  const token = await new SignJWT({ ...s, typ: "patient" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(key());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE });
}

export async function destroyPatientSession() {
  (await cookies()).delete(COOKIE);
}

export async function getPatientSession(): Promise<PatientSession | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload.typ === "patient" ? (payload as unknown as PatientSession) : null;
  } catch {
    return null;
  }
}

export async function requirePatient(): Promise<PatientSession> {
  const s = await getPatientSession();
  if (!s) redirect("/me/login");
  return s;
}

/** এই অ্যাকাউন্টের সব রোগী (পরিবার) */
export async function familyOf(accountId: string) {
  return db.select().from(schema.patients).where(eq(schema.patients.accountId, accountId)).orderBy(schema.patients.createdAt);
}

/** "কার তথ্য দেখছেন" — বাছাই করা সদস্যের আইডি কুকিতে থাকে */
export const MEMBER_COOKIE = "dos_member";
export async function selectedMember<T extends { id: string }>(fam: T[], wanted?: string): Promise<T | undefined> {
  const { cookies } = await import("next/headers");
  const id = wanted ?? (await cookies()).get(MEMBER_COOKIE)?.value;
  return fam.find((p) => p.id === id) ?? fam[0];
}
