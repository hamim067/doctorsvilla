import { and, asc, desc, eq, ne } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { requireRx } from "@/lib/access";
import { requireStaff } from "@/lib/auth";
import { patientCode } from "@/lib/booking";
import { currentMeds, splitList } from "@/lib/meds";
import { normalizePad } from "@/lib/rxpad";
import { buildPadData } from "@/lib/rxpad-data";
import { doctorHabits } from "@/lib/rx-habits";
import { addDays, bn, dateDhaka, formatDateBn, thisYear, today } from "@/lib/time";
import { toRow, vitalsForDoctor } from "@/lib/vitals";
import { RxWriter } from "./RxWriter";
import "../../../print/rxpad.css";
import "./writer.css";

export const metadata = { title: "প্রেসক্রিপশন" };
export const dynamic = "force-dynamic";

const n1 = (x: number | null) => (x === null ? "" : String(x));

export default async function VisitPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const s = await requireStaff();
  await requireRx(s);
  const { bookingId } = await params;
  const [row] = await db
    .select({ b: schema.bookings, p: schema.patients, doctor: schema.doctors, chamber: schema.chambers })
    .from(schema.bookings)
    .innerJoin(schema.patients, eq(schema.patients.id, schema.bookings.patientId))
    .innerJoin(schema.doctors, eq(schema.doctors.id, schema.bookings.doctorId))
    .innerJoin(schema.chambers, eq(schema.chambers.id, schema.bookings.chamberId))
    .where(and(eq(schema.bookings.id, bookingId), eq(schema.bookings.doctorId, s.doctorId)))
    .limit(1);
  if (!row) notFound();
  const { b, p, doctor, chamber } = row;

  const [[visit], past, vitRaw, habits, templates] = await Promise.all([
    db.select().from(schema.visits).where(eq(schema.visits.bookingId, bookingId)).limit(1),
    // এই ডাক্তারের কাছে আগের ভিজিট — অন্য ডাক্তারেরটা দেখানো হয় না
    db.select({ v: schema.visits, date: schema.bookings.date }).from(schema.visits).leftJoin(schema.bookings, eq(schema.bookings.id, schema.visits.bookingId))
      .where(and(eq(schema.visits.patientId, p.id), eq(schema.visits.doctorId, s.doctorId), ne(schema.visits.bookingId, bookingId)))
      .orderBy(desc(schema.visits.createdAt)).limit(30),
    vitalsForDoctor(s.doctorId, p.id, 30),
    doctorHabits(s.doctorId),
    db.select().from(schema.rxTemplates).where(eq(schema.rxTemplates.doctorId, s.doctorId)).orderBy(asc(schema.rxTemplates.name)),
  ]);
  const pastRows = past.map(({ v, date }) => ({ ...v, date: date ?? dateDhaka(v.createdAt) }));
  const vit = vitRaw.map((v) => toRow(v, v.source === "PATIENT" ? "রোগী নিজে" : v.source === "ASSISTANT" ? "অ্যাসিস্ট্যান্ট" : "ডাক্তার"));
  const todayV = vitRaw.find((v) => v.date === b.date && v.doctorId === s.doctorId && v.source !== "PATIENT");
  const lastV = vit.find((v) => v.date !== b.date || !todayV) ?? null;
  const meds = currentMeds(pastRows.map((v) => ({ date: v.date, medicines: v.medicines })), today());
  const age = p.birthYear ? thisYear() - p.birthYear : null;
  const pad = normalizePad(doctor.rxPad);
  const base = await buildPadData({ doctor, patient: p, chamber, visit: null, date: b.date, serialNo: b.serialNo });

  return (
    <RxWriter
      bookingId={bookingId}
      backHref={`/dashboard/queue?chamber=${b.chamberId}`}
      historyHref={`/dashboard/patients/${p.id}`}
      minDate={addDays(today(), 1)}
      patient={{
        name: p.name, code: patientCode(p.number), age: age ? bn(age) : null, gender: p.gender, serial: bn(b.serialNo),
        visitNo: bn(pastRows.length + 1), date: formatDateBn(b.date),
        allergies: splitList(p.allergies), conditions: splitList(p.conditions),
      }}
      lastVitals={lastV ? { date: formatDateBn(lastV.date, false), bp: lastV.sys !== null ? `${bn(lastV.sys)}/${bn(lastV.dia!)}` : null, bpHigh: lastV.sys !== null && (lastV.sys >= 140 || lastV.dia! >= 90), sugar: lastV.sugar !== null ? bn(lastV.sugar) : null, weight: lastV.weight !== null ? `${bn(lastV.weight)} kg` : null, by: lastV.by } : null}
      currentMeds={meds.map((m) => ({ name: m.name, dose: m.dose, when: m.when, days: m.days }))}
      pastVisits={pastRows.slice(0, 6).map((v) => ({ id: v.id, bookingId: v.bookingId, date: formatDateBn(v.date, false), year: bn(v.date.slice(0, 4)), dx: v.diagnosis || v.complaint || "", medicines: v.medicines }))}
      habits={habits}
      templates={templates.map((t) => ({ id: t.id, name: t.name, data: t.data }))}
      pad={pad}
      padBase={base}
      initial={{
        complaint: visit?.complaint ?? "",
        diagnosis: visit?.diagnosis ?? "",
        advice: visit?.advice ?? "",
        investigations: visit?.investigations ?? "",
        medicines: visit?.medicines ?? [],
        followUpDate: visit?.followUpDate ?? null,
        vitals: todayV ? {
          bp: todayV.systolic !== null ? `${todayV.systolic}/${todayV.diastolic}` : "", pulse: n1(todayV.pulse),
          weight: todayV.weightX10 === null ? "" : String(todayV.weightX10 / 10), temp: todayV.tempX10 === null ? "" : String(todayV.tempX10 / 10),
          spo2: n1(todayV.spo2), sugar: todayV.sugarX10 === null ? "" : String(todayV.sugarX10 / 10),
        } : { bp: "", pulse: "", weight: "", temp: "", spo2: "", sugar: "" },
        vitalsBy: todayV ? (todayV.source === "ASSISTANT" ? "অ্যাসিস্ট্যান্ট লিখেছেন" : "") : "",
      }}
      chamberName={chamber.name}
    />
  );
}
