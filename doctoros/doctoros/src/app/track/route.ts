import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { toAsciiDigits } from "@/lib/booking";

// হোম পেজের "সিরিয়াল ট্র্যাক করুন" — কোড (RAJ-1102-07) দিয়ে লাইভ পেজে নিয়ে যায়
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = toAsciiDigits(url.searchParams.get("code") ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (code) {
    const [b] = await db.select({ id: schema.bookings.id }).from(schema.bookings)
      .where(eq(schema.bookings.code, code)).orderBy(desc(schema.bookings.date)).limit(1);
    if (b) return NextResponse.redirect(new URL(`/live/${b.id}`, url));
  }
  return NextResponse.redirect(new URL(`/?track=notfound#track`, url));
}
