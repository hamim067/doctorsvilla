import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { PrintButton } from "@/components/PrintButton";
import { patientCode } from "@/lib/booking";
import { familyOf, requirePatient } from "@/lib/patient-auth";
import { bn, dateDhaka, formatDateBn, thisYear } from "@/lib/time";
import "../../../print/print.css";
import "../../../print/rxpad.css";
import { RxPad } from "@/components/RxPad";
import { normalizePad } from "@/lib/rxpad";
import { buildPadData } from "@/lib/rxpad-data";

export const metadata = { title: "প্রেসক্রিপশন", robots: { index: false } };

/** রোগীর নিজের প্রেসক্রিপশন প্রিন্ট/PDF — শুধু নিজের পরিবারের */
export default async function PatientRxPrint({ params }: { params: Promise<{ id: string }> }) {
  const s = await requirePatient();
  const { id } = await params;
  const fam = await familyOf(s.accountId);
  const [row] = await db.select({ v: schema.visits, date: schema.bookings.date, d: schema.doctors, chamber: schema.chambers })
    .from(schema.visits).innerJoin(schema.doctors, eq(schema.doctors.id, schema.visits.doctorId))
    .leftJoin(schema.bookings, eq(schema.bookings.id, schema.visits.bookingId))
    .leftJoin(schema.chambers, eq(schema.chambers.id, schema.bookings.chamberId))
    .where(eq(schema.visits.id, id)).limit(1);
  const p = row && fam.find((f) => f.id === row.v.patientId);
  if (!row || !p) notFound();
  const { v, d, chamber } = row;
  const date = row.date ?? dateDhaka(v.createdAt);
  const age = p.birthYear ? thisYear() - p.birthYear : null;
  const pad = normalizePad(d.rxPad);
  const data = await buildPadData({ doctor: d, patient: p, chamber: chamber ?? null, visit: v, date, forPatient: true });
  return (
    <>
      <style>{`@page { size: ${pad.paper}; margin: 0; }`}</style>
      <div className="pr-bar">
        <a href={`/me/files/${v.id}`}>← প্রেসক্রিপশনে ফিরুন</a>
        <span className="small muted">রোগীর কপি · প্রিন্ট বা PDF হিসেবে সেভ করুন</span>
        <PrintButton label="প্রিন্ট / PDF" />
      </div>
      <div className="pr-desk"><div className="pr-paper"><RxPad s={pad} d={data} /></div></div>
    </>
  );
}
