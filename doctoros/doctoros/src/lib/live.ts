import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { etaFor, liveState } from "@/lib/queue";
import { clockDhaka, today } from "@/lib/time";

/** রোগীর লাইভ সিরিয়াল পেজ ও অ্যাপের API — দুটোই এটা ব্যবহার করে */
export async function bookingLive(id: string) {
  const [row] = await db
    .select({ b: schema.bookings, doctorName: schema.doctors.name, slug: schema.doctors.slug, patientName: schema.patients.name })
    .from(schema.bookings)
    .innerJoin(schema.doctors, eq(schema.doctors.id, schema.bookings.doctorId))
    .innerJoin(schema.patients, eq(schema.patients.id, schema.bookings.patientId))
    .where(eq(schema.bookings.id, id))
    .limit(1);
  if (!row) return null;
  const state = await liveState(row.b.chamberId, row.b.date);
  if (!state) return null;
  const isToday = row.b.date === today();
  const eta = row.b.status === "WAITING" ? etaFor(state, row.b.serialNo) : null;
  return {
    booking: { id: row.b.id, code: row.b.code, serialNo: row.b.serialNo, date: row.b.date, status: row.b.status, type: row.b.type },
    patientName: row.patientName,
    doctor: { name: row.doctorName, slug: row.slug },
    chamber: { name: state.chamber.name, address: state.chamber.address, city: state.chamber.city },
    isToday,
    current: state.current?.serialNo ?? null,
    ahead: eta?.ahead ?? 0,
    etaMinutes: eta?.minutes ?? 0,
    avgMinutes: state.avg,
    done: state.done,
    total: state.total,
    recent: state.rows
      .filter((r) => r.status === "DONE" || r.status === "ABSENT")
      .slice(-4)
      .reverse()
      .map((r) => ({ serialNo: r.serialNo, status: r.status })),
    updatedAt: clockDhaka(new Date()),
  };
}
