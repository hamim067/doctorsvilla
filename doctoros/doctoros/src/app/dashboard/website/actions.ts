"use server";
import { and, eq, like, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireDoctor } from "@/lib/auth";
import { toAsciiDigits } from "@/lib/booking";
import { contentSchema, hasPremium, tidy } from "@/lib/site";

export type SiteState = { error?: string; ok?: string; at?: number } | undefined;

const MAX_PHOTO = 450_000; // data URL অক্ষর (~৩৩০KB ছবি) — ব্রাউজারেই ছোট করে পাঠানো হয়

export async function saveSite(_: SiteState, fd: FormData): Promise<SiteState> {
  const s = await requireDoctor();
  let raw: unknown;
  try {
    raw = JSON.parse(String(fd.get("content") ?? ""));
  } catch {
    return { error: "তথ্য পড়া যায়নি, পেজ রিফ্রেশ করে আবার চেষ্টা করুন" };
  }
  const parsed = contentSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const content = tidy(parsed.data);
  content.hotline = toAsciiDigits(content.hotline).replace(/[^\d+\- ]/g, "");
  content.whatsapp = toAsciiDigits(content.whatsapp).replace(/\D/g, "");

  const photoIn = String(fd.get("photo") ?? "keep");
  let photo: string | null | undefined; // undefined = বদলাবে না
  if (photoIn === "remove") photo = null;
  else if (photoIn !== "keep") {
    if (!/^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/.test(photoIn)) return { error: "ছবিটা পড়া যায়নি, অন্য ছবি দিন" };
    if (photoIn.length > MAX_PHOTO) return { error: "ছবিটা অনেক বড়, ছোট ছবি দিন" };
    photo = photoIn;
  }

  const [doctor] = await db.select({ plan: schema.doctors.plan, premiumUntil: schema.doctors.premiumUntil, slug: schema.doctors.slug })
    .from(schema.doctors).where(eq(schema.doctors.id, s.doctorId)).limit(1);
  const premium = hasPremium(doctor);
  const wantPublish = fd.get("published") === "1" && premium;
  if (wantPublish && !content.bn.heroTitle.trim()) return { error: "প্রকাশ করার আগে মূল অংশের শিরোনাম লিখুন" };

  // অভিজ্ঞতার বছর — প্রোফাইলেই রাখি, যেন সব জায়গায় একই সংখ্যা থাকে
  const expRaw = toAsciiDigits(String(fd.get("experience") ?? "")).trim();
  if (expRaw !== "") {
    const n = Number(expRaw);
    if (!Number.isInteger(n) || n < 0 || n > 60) return { error: "অভিজ্ঞতার বছর ০ থেকে ৬০-এর মধ্যে দিন" };
  }
  if (fd.has("experience")) await db.update(schema.doctors).set({ experienceYears: expRaw === "" ? null : Number(expRaw) }).where(eq(schema.doctors.id, s.doctorId));

  const values = { content, published: wantPublish, updatedAt: new Date(), ...(photo !== undefined ? { photo } : {}) };
  await db.insert(schema.doctorSites).values({ doctorId: s.doctorId, ...values })
    .onConflictDoUpdate({ target: schema.doctorSites.doctorId, set: values });

  // মুছে ফেলা লেখার কভার ছবিও মুছে দিই — অকারণে জায়গা না নেয়
  const keep = content.posts.map((p) => `post-${p.id}`);
  await db.delete(schema.doctorAssets).where(and(eq(schema.doctorAssets.doctorId, s.doctorId), like(schema.doctorAssets.kind, "post-%"), ...(keep.length ? [notInArray(schema.doctorAssets.kind, keep)] : [])));

  revalidatePath("/dashboard/website");
  revalidatePath("/dashboard/profile");
  revalidatePath(`/dr/${doctor.slug}`);
  if (fd.get("published") === "1" && !premium) return { error: "লেখা সেভ হয়েছে, কিন্তু প্রকাশ করতে Premium লাগবে", at: Date.now() };
  return { ok: wantPublish ? "সেভ হয়েছে — ওয়েবসাইট প্রকাশিত" : "সেভ হয়েছে (এখনো প্রকাশ হয়নি)", at: Date.now() };
}

/** ব্লগের কভার ছবি — বেছে নিলেই সেভ হয় (ব্রাউজারে ছোট করা JPEG); ফেরত দেয় সংস্করণ নম্বর */
export async function savePostCover(postId: string, dataUrl: string | null): Promise<{ v?: number; url?: string; error?: string }> {
  const s = await requireDoctor();
  if (!/^[a-z0-9]{6,16}$/.test(postId)) return { error: "ভুল লেখা" };
  const kind = `post-${postId}`;
  if (dataUrl === null) {
    await db.delete(schema.doctorAssets).where(and(eq(schema.doctorAssets.doctorId, s.doctorId), eq(schema.doctorAssets.kind, kind)));
    return { v: 0 };
  }
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) return { error: "ছবিটা পড়া যায়নি — JPG বা PNG দিন" };
  if (dataUrl.length > 600_000) return { error: "ছবিটা অনেক বড়, ছোট ছবি দিন" };
  const v = Date.now();
  const values = { data: dataUrl, width: null, height: null, updatedAt: new Date(v) };
  await db.insert(schema.doctorAssets).values({ doctorId: s.doctorId, kind, ...values })
    .onConflictDoUpdate({ target: [schema.doctorAssets.doctorId, schema.doctorAssets.kind], set: values });
  const [d] = await db.select({ slug: schema.doctors.slug }).from(schema.doctors).where(eq(schema.doctors.id, s.doctorId)).limit(1);
  return { v, url: `/dr/${d.slug}/asset/${kind}?v=${v}` };
}
