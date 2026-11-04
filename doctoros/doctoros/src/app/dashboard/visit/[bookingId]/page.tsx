import { and, desc, eq, ne, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { requireRx } from "@/lib/access";
import { requireStaff } from "@/lib/auth";
import { patientCode } from "@/lib/booking";
import { addDays, bn, dateDhaka, formatDateBn, today, thisYear } from "@/lib/time";
import { VitalsPanel } from "@/components/Vitals";
import { toRow, vitalsForDoctor } from "@/lib/vitals";
import { addVitalForPatient } from "../../patients/actions";
import { PrescriptionForm } from "./PrescriptionForm";

export const metadata = { title: "প্রেসক্রিপশন" };

export default async function VisitPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const s = await requireStaff();
  await requireRx(s);
  const { bookingId } = await params;
  const [row] = await db
    .select({ b: schema.bookings, p: schema.patients, doctor: schema.doctors })
    .from(schema.bookings)
    .innerJoin(schema.patients, eq(schema.patients.id, schema.bookings.patientId))
    .innerJoin(schema.doctors, eq(schema.doctors.id, schema.bookings.doctorId))
    .where(and(eq(schema.bookings.id, bookingId), eq(schema.bookings.doctorId, s.doctorId)))
    .limit(1);
  if (!row) notFound();
  const [visit] = await db.select().from(schema.visits).where(eq(schema.visits.bookingId, bookingId)).limit(1);
  // এই ডাক্তারের আগের প্রেসক্রিপশন থেকে ওষুধের নাম — এক ক্লিকে বসানোর জন্য
  const sugg = await db.execute<{ name: string }>(sql`
    select distinct m->>'name' as name from visits v, jsonb_array_elements(v.medicines) m
    where v.doctor_id = ${s.doctorId} and coalesce(m->>'name','') <> '' order by 1 limit 300`);
  // আগের প্রেসক্রিপশন (এই ডাক্তারের) — এক চাপে কপি করার জন্য
  const [prev] = await db.select({ medicines: schema.visits.medicines, createdAt: schema.visits.createdAt }).from(schema.visits)
    .where(and(eq(schema.visits.patientId, row.p.id), eq(schema.visits.doctorId, s.doctorId), ne(schema.visits.bookingId, bookingId)))
    .orderBy(desc(schema.visits.createdAt)).limit(1);
  const vit = (await vitalsForDoctor(s.doctorId, row.p.id, 30)).map((v) => toRow(v, v.source === "PATIENT" ? "রোগী নিজে" : v.source === "ASSISTANT" ? "অ্যাসিস্ট্যান্ট" : "ডাক্তার"));
  const age = row.p.birthYear ? thisYear() - row.p.birthYear : null;

  return (
    <>
      <Link href={`/dashboard/queue?chamber=${row.b.chamberId}`} className="small no-print">← সিরিয়াল কিউ</Link>
      <div className="stack-sm" style={{ gap: 0 }}>
        <span className="muted">সিরিয়াল {bn(row.b.serialNo)} · {row.p.name} · {patientCode(row.p.number)}{age ? ` · ${bn(age)} বছর` : ""} · {formatDateBn(row.b.date)}</span>
        <h1>প্রেসক্রিপশন <span className="muted small" style={{ fontWeight: 400 }}>— {row.doctor.name}, {row.doctor.degrees}</span></h1>
      </div>
      {(row.p.allergies || row.p.conditions) && (
        <div className="rx-warn" role="note">
          {row.p.allergies && <span><b>⚠ অ্যালার্জি:</b> {row.p.allergies}</span>}
          {row.p.conditions && <span><b>দীর্ঘমেয়াদি রোগ:</b> {row.p.conditions}</span>}
        </div>
      )}
      <PrescriptionForm
        bookingId={bookingId}
        minDate={addDays(today(), 1)}
        suggestions={sugg.rows.map((r) => r.name)}
        previous={prev && prev.medicines.length ? { medicines: prev.medicines, label: formatDateBn(dateDhaka(prev.createdAt), false) } : null}
        initial={{
          complaint: visit?.complaint ?? "",
          diagnosis: visit?.diagnosis ?? "",
          advice: visit?.advice ?? "",
          medicines: visit?.medicines ?? [],
          followUpDate: visit?.followUpDate ?? null,
        }}
      />
      <section className="card stack no-print" aria-label="প্রেসার ও সুগার">
        <div className="row-sb"><h2>প্রেসার, সুগার ও ওজন</h2><span className="small muted">আজকের মাপ এখানে লিখুন — রোগীর ফাইলেও যাবে</span></div>
        <VitalsPanel rows={vit} compact action={addVitalForPatient.bind(null, row.p.id)} />
      </section>
      <p className="muted small no-print"><Link href={`/dashboard/patients/${row.p.id}`}>রোগীর আগের ইতিহাস দেখুন →</Link></p>
    </>
  );
}
