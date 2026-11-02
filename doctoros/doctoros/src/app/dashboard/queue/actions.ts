"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireStaff } from "@/lib/auth";
import { assertChamber } from "@/lib/chambers";
import { str } from "@/lib/form";
import { advanceQueue, requeue } from "@/lib/queue";
import { today } from "@/lib/time";

export async function queueAction(fd: FormData) {
  const s = await requireStaff();
  const chamberId = str(fd, "chamberId");
  await assertChamber(s.doctorId, chamberId);
  const action = str(fd, "action");
  if (action === "done" || action === "absent" || action === "start") await advanceQueue(chamberId, today(), action);
  revalidatePath("/dashboard/queue");
}

export async function requeueAction(fd: FormData) {
  const s = await requireStaff();
  const [b] = await db
    .select({ id: schema.bookings.id })
    .from(schema.bookings)
    .where(and(eq(schema.bookings.id, str(fd, "bookingId")), eq(schema.bookings.doctorId, s.doctorId)))
    .limit(1);
  if (b) await requeue(b.id);
  revalidatePath("/dashboard/queue");
}
