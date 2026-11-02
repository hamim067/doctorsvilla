"use server";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { createSession, hashPassword, requireDoctor, requireStaff, verifyPassword } from "@/lib/auth";
import { toAsciiDigits } from "@/lib/booking";
import { type FormState, int, str } from "@/lib/form";

const profileSchema = z.object({
  name: z.string().min(3, "নাম দিন"),
  degrees: z.string().min(2, "ডিগ্রি দিন"),
  specialty: z.string().min(2, "বিশেষজ্ঞতা দিন"),
  bmdcNo: z.string().regex(/^[A-Z]?-?\d{3,7}$/, "সঠিক BMDC নাম্বার দিন, যেমন A-12345"),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{2,40}$/, "প্রোফাইল লিংক: ইংরেজি ছোট হাতের অক্ষর, সংখ্যা ও - (কমপক্ষে ৩ অক্ষর)"),
  bio: z.string().max(1500, "পরিচিতি ১৫০০ অক্ষরের মধ্যে রাখুন"),
  experienceYears: z.number().int().min(0).max(70).nullable(),
});

export async function saveProfile(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requireDoctor();
  const parsed = profileSchema.safeParse({
    name: str(fd, "name"),
    degrees: str(fd, "degrees"),
    specialty: str(fd, "specialty"),
    bmdcNo: toAsciiDigits(str(fd, "bmdcNo")).replace(/\s+/g, "").toUpperCase(),
    slug: str(fd, "slug").toLowerCase(),
    bio: str(fd, "bio"),
    experienceYears: int(fd, "experienceYears"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const [taken] = await db.select({ id: schema.doctors.id }).from(schema.doctors)
    .where(and(eq(schema.doctors.slug, v.slug), ne(schema.doctors.id, s.doctorId))).limit(1);
  if (taken) return { error: "এই প্রোফাইল লিংক অন্য কেউ নিয়েছেন, অন্যটা দিন" };
  const [before] = await db.select({ bmdcNo: schema.doctors.bmdcNo }).from(schema.doctors).where(eq(schema.doctors.id, s.doctorId)).limit(1);
  await db.update(schema.doctors).set({
    ...v,
    bio: v.bio || null,
    // BMDC নাম্বার বদলালে যাচাই আবার করতে হবে
    ...(before && before.bmdcNo !== v.bmdcNo ? { bmdcVerified: false } : {}),
  }).where(eq(schema.doctors.id, s.doctorId));
  await db.update(schema.users).set({ name: v.name }).where(eq(schema.users.id, s.uid));
  await createSession({ ...s, name: v.name });
  revalidatePath("/dashboard", "layout");
  return { ok: "প্রোফাইল সেভ হয়েছে" };
}

/** নিজের পাসওয়ার্ড বদল (ডাক্তার বা অ্যাসিস্ট্যান্ট) */
export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requireStaff();
  const current = str(fd, "current");
  const next = str(fd, "next");
  if (next.length < 8) return { error: "নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষর" };
  if (next !== str(fd, "confirm")) return { error: "নতুন পাসওয়ার্ড দুবার একই হয়নি" };
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, s.uid)).limit(1);
  if (!u || !(await verifyPassword(current, u.passwordHash))) return { error: "বর্তমান পাসওয়ার্ড ভুল" };
  await db.update(schema.users).set({ passwordHash: await hashPassword(next) }).where(eq(schema.users.id, s.uid));
  return { ok: "পাসওয়ার্ড বদলানো হয়েছে" };
}
