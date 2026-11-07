"use server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { normalizePhone, toAsciiDigits } from "@/lib/booking";
import { type FormState, str } from "@/lib/form";
import { blockedFor, clearLimit, clientIp, hit } from "@/lib/rate-limit";
import { bn } from "@/lib/time";

const registerSchema = z.object({
  name: z.string().min(3, "ডাক্তারের নাম দিন"),
  degrees: z.string().min(2, "ডিগ্রি দিন (যেমন MBBS, FCPS)"),
  specialty: z.string().min(2, "বিশেষজ্ঞতা দিন"),
  bmdcNo: z.string().regex(/^[A-Za-z]?-?\d{3,7}$/, "সঠিক BMDC নাম্বার দিন, যেমন A-12345"),
  slug: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{2,40}$/, "প্রোফাইল লিংক: ইংরেজি ছোট হাতের অক্ষর, সংখ্যা ও - (কমপক্ষে ৩ অক্ষর)"),
  password: z.string().min(8, "পাসওয়ার্ড কমপক্ষে ৮ অক্ষর"),
});

export async function registerDoctor(_: FormState, fd: FormData): Promise<FormState> {
  const phone = normalizePhone(str(fd, "phone"));
  if (!phone) return { error: "সঠিক মোবাইল নাম্বার দিন" };
  const parsed = registerSchema.safeParse({
    name: str(fd, "name"),
    degrees: str(fd, "degrees"),
    specialty: str(fd, "specialty"),
    // বাংলা সংখ্যা, ফাঁকা জায়গা, ছোট হাতের অক্ষর — সব মেনে নিয়ে A-12345 আকারে রাখি
    bmdcNo: toAsciiDigits(str(fd, "bmdcNo")).replace(/\s+/g, "").toUpperCase(),
    slug: str(fd, "slug").toLowerCase(),
    password: str(fd, "password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  const [taken] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.phone, phone)).limit(1);
  if (taken) return { error: "এই নাম্বারে আগেই অ্যাকাউন্ট আছে — লগইন করুন" };
  const [slugTaken] = await db.select({ id: schema.doctors.id }).from(schema.doctors).where(eq(schema.doctors.slug, v.slug)).limit(1);
  if (slugTaken) return { error: "এই প্রোফাইল লিংক আগেই নেওয়া হয়েছে, অন্যটা দিন" };

  const { user, doctor } = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(schema.users)
      .values({ name: v.name, phone, passwordHash: await hashPassword(v.password), role: "DOCTOR" })
      .returning();
    const [doctor] = await tx
      .insert(schema.doctors)
      .values({ slug: v.slug, name: v.name, degrees: v.degrees, specialty: v.specialty, bmdcNo: v.bmdcNo, ownerId: user.id })
      .returning();
    await tx.update(schema.users).set({ doctorId: doctor.id }).where(eq(schema.users.id, user.id));
    return { user, doctor };
  });

  await createSession({ uid: user.id, role: "DOCTOR", doctorId: doctor.id, name: user.name });
  redirect("/dashboard/chambers?welcome=1");
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const phone = normalizePhone(str(fd, "phone"));
  const password = str(fd, "password");
  if (!phone || !password) return { error: "মোবাইল নাম্বার ও পাসওয়ার্ড দিন" };
  // ভুল পাসওয়ার্ড আন্দাজ ঠেকানো: এক নাম্বারে ৫ বার ভুল হলে ১৫ মিনিট বন্ধ; এক জায়গা থেকে ঘণ্টায় ৩০ বার
  const key = `login:${phone}`, ipKey = `login-ip:${await clientIp()}`;
  const wait = Math.max(await blockedFor(key, 5), await blockedFor(ipKey, 30));
  if (wait) return { error: `অনেকবার ভুল হয়েছে — ${bn(wait)} মিনিট পরে আবার চেষ্টা করুন` };
  const [user] = await db.select().from(schema.users).where(eq(schema.users.phone, phone)).limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash)) || !user.doctorId) {
    await hit(key, 5, 15 * 60);
    await hit(ipKey, 30, 60 * 60);
    return { error: "মোবাইল নাম্বার বা পাসওয়ার্ড ভুল" };
  }
  await clearLimit(key);
  await createSession({ uid: user.id, role: user.role, doctorId: user.doctorId, name: user.name });
  redirect(user.role === "ASSISTANT" ? "/dashboard/queue" : "/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
