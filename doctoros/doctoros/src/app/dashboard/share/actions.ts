"use server";
import { eq } from "drizzle-orm";
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
