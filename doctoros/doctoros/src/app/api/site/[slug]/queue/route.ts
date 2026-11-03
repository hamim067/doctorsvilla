import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { liveState } from "@/lib/queue";
import { clockDhaka, today } from "@/lib/time";

export const dynamic = "force-dynamic";

/**
 * ডাক্তারের ওয়েবসাইটের "আজকের সিরিয়াল" — প্রতিটা চেম্বারে কত নম্বর চলছে, কতজন অপেক্ষায়।
 * শুধু সিরিয়াল নম্বর আর অবস্থা — রোগীর নাম বা ফোন কখনো এখানে আসে না।
 */
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [doctor] = await db.select({ id: schema.doctors.id }).from(schema.doctors).where(eq(schema.doctors.slug, slug)).limit(1);
  if (!doctor) return NextResponse.json({ error: "not found" }, { status: 404 });
  const chambers = await db.query.chambers.findMany({
    where: and(eq(schema.chambers.doctorId, doctor.id), eq(schema.chambers.active, true)),
    with: { schedules: true },
    orderBy: asc(schema.chambers.createdAt),
  });
  const t = today();
  const wd = new Date(`${t}T00:00:00Z`).getUTCDay();
  const out = await Promise.all(chambers.map(async (c) => {
    const st = await liveState(c.id, t);
    const sch = c.schedules.find((x) => x.weekday === wd);
    const rows = (st?.rows ?? []).filter((r) => r.status !== "CANCELLED");
    return {
      id: c.id, name: c.name, city: c.city,
      open: Boolean(sch), start: sch?.startTime ?? null, end: sch?.endTime ?? null,
      current: st?.current?.serialNo ?? null,
      total: rows.length,
      waiting: rows.filter((r) => r.status === "WAITING").length,
      done: rows.filter((r) => r.status === "DONE").length,
      avg: st?.avg ?? c.avgMinutes,
      list: rows.map((r) => ({ n: r.serialNo, s: r.status })),
    };
  }));
  return NextResponse.json({ chambers: out, at: clockDhaka(new Date()) }, { headers: { "Cache-Control": "no-store" } });
}
