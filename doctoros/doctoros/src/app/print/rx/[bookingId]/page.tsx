import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { PrintButton } from "@/components/PrintButton";
import { requireStaff } from "@/lib/auth";
import { patientCode } from "@/lib/booking";
import { qrSvg, siteOrigin } from "@/lib/qr";
import { bn, formatDateBn } from "@/lib/time";
import "../../print.css";

export const metadata = { title: "প্রেসক্রিপশন প্রিন্ট", robots: { index: false } };

export default async function RxPrint({ params, searchParams }: { params: Promise<{ bookingId: string }>; searchParams: Promise<{ auto?: string }> }) {
  const s = await requireStaff();
  const { bookingId } = await params;
  const { auto } = await searchParams;
  const [row] = await db
    .select({ b: schema.bookings, p: schema.patients, doctor: schema.doctors, chamber: schema.chambers })
    .from(schema.bookings)
    .innerJoin(schema.patients, eq(schema.patients.id, schema.bookings.patientId))
    .innerJoin(schema.doctors, eq(schema.doctors.id, schema.bookings.doctorId))
    .innerJoin(schema.chambers, eq(schema.chambers.id, schema.bookings.chamberId))
    .where(and(eq(schema.bookings.id, bookingId), eq(schema.bookings.doctorId, s.doctorId)))
    .limit(1);
  if (!row) notFound();
  const [v] = await db.select().from(schema.visits).where(eq(schema.visits.bookingId, bookingId)).limit(1);
  const { b, p, doctor: d, chamber: c } = row;
  const age = p.birthYear ? new Date().getFullYear() - p.birthYear : null;
  const url = `${await siteOrigin()}/dr/${d.slug}`;
  const svg = await qrSvg(url);

  return (
    <>
      <div className="pr-bar">
        <Link href={`/dashboard/visit/${b.id}`}>← প্রেসক্রিপশনে ফিরুন</Link>
        <span className="small muted">{v ? "A4 প্রেসক্রিপশন" : "এখনো সেভ করা প্রেসক্রিপশন নেই"}</span>
        <PrintButton />
      </div>
      {auto && <script dangerouslySetInnerHTML={{ __html: "window.addEventListener('load',()=>setTimeout(()=>window.print(),400))" }} />}
      <div className="pr-desk"><div className="pr-a4 rx">
        <header className="rx-head">
          <div>
            <h1>{d.name}</h1>
            <div className="deg">{d.degrees}</div>
            <div className="deg">{d.specialty}</div>
            <div className="deg">BMDC রেজি: {d.bmdcNo}</div>
          </div>
          <div className="right">
            <b style={{ color: "#10231F", fontSize: "11pt" }}>{c.name}</b>
            <span>{c.address}, {c.city}</span>
            <span>সিরিয়াল: {url.replace(/^https?:\/\//, "")}</span>
          </div>
        </header>

        <div className="rx-pt">
          <span><b>নাম:</b> {p.name}</span>
          {age !== null && <span><b>বয়স:</b> {bn(age)} বছর</span>}
          {p.gender && <span><b>লিঙ্গ:</b> {p.gender}</span>}
          <span><b>আইডি:</b> {patientCode(p.number)}</span>
          <span><b>তারিখ:</b> {formatDateBn(b.date, false)} {bn(b.date.slice(0, 4))}</span>
          <span><b>সিরিয়াল:</b> {bn(b.serialNo)}</span>
        </div>

        <div className="rx-body">
          <aside className="rx-left">
            <div><h3>অভিযোগ</h3><div>{v?.complaint || "—"}</div></div>
            <div><h3>রোগ নির্ণয়</h3><div>{v?.diagnosis || "—"}</div></div>
          </aside>
          <section className="rx-right">
            <span className="rx-sym" aria-label="ওষুধ">Rx</span>
            <div>
              {(v?.medicines ?? []).length === 0 && <span className="muted">—</span>}
              {(v?.medicines ?? []).map((m, i) => (
                <div key={i} className="rx-med">
                  <b>{bn(i + 1)}. {m.name}</b>
                  <span>{[m.dose, m.when, m.days].filter(Boolean).join(" — ")}</span>
                </div>
              ))}
            </div>
            {v?.advice && <div><h3>পরীক্ষা ও পরামর্শ</h3><div style={{ whiteSpace: "pre-line" }}>{v.advice}</div></div>}
            {v?.followUpDate && <div className="rx-fu">পরবর্তী সাক্ষাৎ: {formatDateBn(v.followUpDate)} — আগের দিন এসএমএসে মনে করিয়ে দেওয়া হবে</div>}
          </section>
        </div>

        <footer className="rx-foot">
          <div className="rx-qr">
            <div dangerouslySetInnerHTML={{ __html: svg }} />
            <span>পরের বার সিরিয়াল নিতে<br />QR স্ক্যান করুন</span>
          </div>
          <div className="rx-sign">স্বাক্ষর</div>
        </footer>
      </div></div>
    </>
  );
}
