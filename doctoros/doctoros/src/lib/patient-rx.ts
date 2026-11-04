import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { dateDhaka } from "@/lib/time";

/** একজন সদস্যের সব প্রেসক্রিপশন — ডাক্তার ও চেম্বারসহ, নতুনটা আগে */
export async function memberRx(patientId: string, limit = 200) {
  const rows = await db.select({ v: schema.visits, date: schema.bookings.date, doctorId: schema.doctors.id, doctorName: schema.doctors.name, degrees: schema.doctors.degrees, specialty: schema.doctors.specialty, slug: schema.doctors.slug, chamberId: schema.bookings.chamberId })
    .from(schema.visits)
    .innerJoin(schema.doctors, eq(schema.doctors.id, schema.visits.doctorId))
    .leftJoin(schema.bookings, eq(schema.bookings.id, schema.visits.bookingId))
    .where(eq(schema.visits.patientId, patientId))
    .orderBy(desc(schema.visits.createdAt)).limit(limit);
  return rows.map((r) => ({ ...r, date: r.date ?? dateDhaka(r.v.createdAt) }));
}
export type MemberRx = Awaited<ReturnType<typeof memberRx>>[number];
