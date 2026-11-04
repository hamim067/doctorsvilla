import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { PrintButton } from "@/components/PrintButton";
import { patientCode } from "@/lib/booking";
import { familyOf, requirePatient } from "@/lib/patient-auth";
import { bn, dateDhaka, formatDateBn, thisYear } from "@/lib/time";
import "../../../print/print.css";

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
  return (
    <>
      <div className="pr-bar">
        <a href="/me/files">← প্রেসক্রিপশনে ফিরুন</a>
        <span className="small muted">রোগীর কপি · প্রিন্ট বা PDF হিসেবে সেভ করুন</span>
        <PrintButton label="প্রিন্ট / PDF" />
      </div>
      <div className="pr-desk"><div className="pr-a4 rx">
        <header className="rx-head">
          <div>
            <h1>{d.name}</h1>
            <div className="deg">{d.degrees}</div>
            <div className="deg">{d.specialty}</div>
            <div className="deg">BMDC রেজি: {d.bmdcNo}</div>
          </div>
          {chamber && <div className="right"><b style={{ color: "#10231F", fontSize: "11pt" }}>{chamber.name}</b><span>{chamber.address}, {chamber.city}</span></div>}
        </header>
        <div className="rx-pt">
          <span><b>নাম:</b> {p.name}</span>
          {age !== null && <span><b>বয়স:</b> {bn(age)} বছর</span>}
          {p.gender && <span><b>লিঙ্গ:</b> {p.gender}</span>}
          <span><b>আইডি:</b> {patientCode(p.number)}</span>
          <span><b>তারিখ:</b> {formatDateBn(date, false)} {bn(date.slice(0, 4))}</span>
        </div>
        <div className="rx-body">
          <aside className="rx-left">
            <div><h3>অভিযোগ</h3><div>{v.complaint || "—"}</div></div>
            <div><h3>রোগ নির্ণয়</h3><div>{v.diagnosis || "—"}</div></div>
          </aside>
          <section className="rx-right">
            <span className="rx-sym" aria-label="ওষুধ">Rx</span>
            <div>{v.medicines.map((m, i) => <div key={i} className="rx-med"><b>{bn(i + 1)}. {m.name}</b><span>{[m.dose, m.when, m.days].filter(Boolean).join(" — ")}</span></div>)}</div>
            {v.advice && <div><h3>পরীক্ষা ও পরামর্শ</h3><div style={{ whiteSpace: "pre-line" }}>{v.advice}</div></div>}
            {v.followUpDate && <div className="rx-fu">আবার দেখানোর দিন: {formatDateBn(v.followUpDate)}</div>}
          </section>
        </div>
        <footer className="rx-foot"><span>DoctorOS থেকে রোগীর কপি</span><div className="rx-sign">স্বাক্ষর</div></footer>
      </div></div>
    </>
  );
}
