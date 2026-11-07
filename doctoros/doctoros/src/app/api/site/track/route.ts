import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { normalizePhone, toAsciiDigits } from "@/lib/booking";
import { clientIp, hit } from "@/lib/rate-limit";

/**
 * "আমার সিরিয়াল খুঁজুন" — মোবাইল নম্বর আর সিরিয়াল কোড দুটোই মিললে তবেই লাইভ পেজের লিংক দেয়,
 * যেন শুধু কোড আন্দাজ করে কেউ অন্যের তথ্য দেখতে না পারে।
 */
export async function POST(req: Request) {
  // নাম্বার+কোড আন্দাজ করে খোঁজা ঠেকাতে — এক জায়গা থেকে ১০ মিনিটে ২০ বার
  if (!(await hit(`track-ip:${await clientIp()}`, 20, 600))) return NextResponse.json({ error: "slow" }, { status: 429 });
  let body: { phone?: string; code?: string; slug?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad" }, { status: 400 }); }
  const phone = normalizePhone(String(body.phone ?? ""));
  const code = toAsciiDigits(String(body.code ?? "")).trim().toUpperCase().replace(/\s+/g, "");
  if (!phone || !/^[A-Z0-9]{2,8}-\d{4}-\d{1,3}$/.test(code)) return NextResponse.json({ error: "format" }, { status: 400 });
  const rows = await db.select({ id: schema.bookings.id, slug: schema.doctors.slug })
    .from(schema.bookings)
    .innerJoin(schema.patients, eq(schema.patients.id, schema.bookings.patientId))
    .innerJoin(schema.patientAccounts, eq(schema.patientAccounts.id, schema.patients.accountId))
    .innerJoin(schema.doctors, eq(schema.doctors.id, schema.bookings.doctorId))
    .where(and(eq(schema.bookings.code, code), eq(schema.patientAccounts.phone, phone)))
    .orderBy(desc(schema.bookings.date)).limit(1);
  if (!rows[0]) return NextResponse.json({ error: "notfound" }, { status: 404 });
  return NextResponse.json({ url: `/live/${rows[0].id}` });
}
