"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { hashPassword, requireDoctor } from "@/lib/auth";
import { normalizePhone } from "@/lib/booking";
import { type FormState, str } from "@/lib/form";

export async function addAssistant(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requireDoctor();
  const name = str(fd, "name");
  const phone = normalizePhone(str(fd, "phone"));
  const password = str(fd, "password");
  if (name.length < 2) return { error: "নাম দিন" };
  if (!phone) return { error: "সঠিক মোবাইল নাম্বার দিন" };
  if (password.length < 6) return { error: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষর" };
  const [taken] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.phone, phone)).limit(1);
  if (taken) return { error: "এই নাম্বারে আগেই অ্যাকাউন্ট আছে" };
  await db.insert(schema.users).values({ name, phone, passwordHash: await hashPassword(password), role: "ASSISTANT", doctorId: s.doctorId });
  revalidatePath("/dashboard/staff");
  return { ok: `${name} যোগ হয়েছেন। এই নাম্বার ও পাসওয়ার্ড দিয়ে লগইন করবেন।` };
}

export async function removeAssistant(fd: FormData) {
  const s = await requireDoctor();
  await db
    .delete(schema.users)
    .where(and(eq(schema.users.id, str(fd, "id")), eq(schema.users.doctorId, s.doctorId), eq(schema.users.role, "ASSISTANT")));
  revalidatePath("/dashboard/staff");
}
