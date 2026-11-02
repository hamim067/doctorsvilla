import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { today, weekday } from "@/lib/time";

export async function doctorChambers(doctorId: string) {
  return db.query.chambers.findMany({
    where: and(eq(schema.chambers.doctorId, doctorId), eq(schema.chambers.active, true)),
    with: { schedules: true },
    orderBy: asc(schema.chambers.createdAt),
  });
}

/** URL-এ চেম্বার না থাকলে: আজ যে চেম্বার খোলা সেটা, নাহলে প্রথমটা */
export function pickChamber<T extends { id: string; schedules: { weekday: number }[] }>(list: T[], wanted?: string) {
  if (wanted) {
    const c = list.find((x) => x.id === wanted);
    if (c) return c;
  }
  const wd = weekday(today());
  return list.find((c) => c.schedules.some((s) => s.weekday === wd)) ?? list[0] ?? null;
}

/** স্টাফ শুধু নিজের ডাক্তারের চেম্বারে কাজ করতে পারবে */
export async function assertChamber(doctorId: string, chamberId: string) {
  const [c] = await db
    .select()
    .from(schema.chambers)
    .where(and(eq(schema.chambers.id, chamberId), eq(schema.chambers.doctorId, doctorId)))
    .limit(1);
  if (!c) throw new Error("এই চেম্বারে অনুমতি নেই");
  return c;
}
