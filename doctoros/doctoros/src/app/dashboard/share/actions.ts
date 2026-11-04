"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireDoctor } from "@/lib/auth";
import { padSchema } from "@/lib/rxpad";

export type PadState = { ok?: string; error?: string; at?: number } | undefined;

/** প্রেসক্রিপশন প্যাডের ডিজাইন সেভ */
export async function savePad(_: PadState, fd: FormData): Promise<PadState> {
  const s = await requireDoctor();
  let raw: unknown;
  try { raw = JSON.parse(String(fd.get("pad") ?? "")); } catch { return { error: "তথ্য পড়া যায়নি, আবার চেষ্টা করুন" }; }
  const r = padSchema.safeParse(raw);
  if (!r.success) return { error: "কিছু ঘর ঠিক নেই, দেখে আবার সেভ করুন" };
  await db.update(schema.doctors).set({ rxPad: r.data }).where(eq(schema.doctors.id, s.doctorId));
  revalidatePath("/dashboard/share");
  return { ok: "সেভ হয়েছে — এখন থেকে প্রেসক্রিপশন এই ডিজাইনে প্রিন্ট হবে", at: Date.now() };
}

const MAX = { logo: 400_000, pad: 2_600_000 } as const;

/** লোগো বা নিজের প্যাডের ছবি সেভ (ব্রাউজারেই ছোট করা) */
export async function saveAsset(kind: "logo" | "pad", dataUrl: string, width: number, height: number): Promise<PadState & { url?: string }> {
  const s = await requireDoctor();
  if (kind !== "logo" && kind !== "pad") return { error: "ভুল ধরন" };
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) return { error: "ছবিটা পড়া যায়নি — JPG বা PNG দিন" };
  if (dataUrl.length > MAX[kind]) return { error: "ছবিটা অনেক বড়, একটু ছোট ছবি দিন" };
  const values = { data: dataUrl, width: Math.round(width) || null, height: Math.round(height) || null, updatedAt: new Date() };
  await db.insert(schema.doctorAssets).values({ doctorId: s.doctorId, kind, ...values })
    .onConflictDoUpdate({ target: [schema.doctorAssets.doctorId, schema.doctorAssets.kind], set: values });
  const [d] = await db.select({ slug: schema.doctors.slug }).from(schema.doctors).where(eq(schema.doctors.id, s.doctorId)).limit(1);
  revalidatePath("/dashboard/share");
  return { ok: kind === "logo" ? "লোগো সেভ হয়েছে — সব ফরম্যাটে বসে গেছে" : "প্যাড সেভ হয়েছে", at: Date.now(), url: `/dr/${d.slug}/asset/${kind}?v=${Date.now()}` };
}

export async function removeAsset(kind: "logo" | "pad"): Promise<PadState> {
  const s = await requireDoctor();
  await db.delete(schema.doctorAssets).where(and(eq(schema.doctorAssets.doctorId, s.doctorId), eq(schema.doctorAssets.kind, kind)));
  revalidatePath("/dashboard/share");
  return { ok: "সরানো হয়েছে", at: Date.now() };
}
