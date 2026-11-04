import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { PrintButton } from "@/components/PrintButton";
import { RxPad } from "@/components/RxPad";
import { requireRx } from "@/lib/access";
import { requireStaff } from "@/lib/auth";
import { normalizePad } from "@/lib/rxpad";
import { buildPadData } from "@/lib/rxpad-data";
import "../../print.css";
import "../../rxpad.css";

export const metadata = { title: "প্রেসক্রিপশন প্রিন্ট", robots: { index: false } };

/** ডাক্তারের প্রেসক্রিপশন প্রিন্ট — "শেয়ার ও QR" পেজে বাছা প্যাডের ডিজাইনে */
export default async function RxPrint({ params, searchParams }: { params: Promise<{ bookingId: string }>; searchParams: Promise<{ auto?: string }> }) {
  const s = await requireStaff();
  await requireRx(s);
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
  const pad = normalizePad(row.doctor.rxPad);
  const data = await buildPadData({ doctor: row.doctor, patient: row.p, chamber: row.chamber, visit: v ?? null, date: row.b.date, serialNo: row.b.serialNo });
  return (
    <>
      <style>{`@page { size: ${pad.paper}; margin: 0; }`}</style>
      <div className="pr-bar">
        <Link href={`/dashboard/visit/${bookingId}`}>← প্রেসক্রিপশনে ফিরুন</Link>
        <span className="small muted">{v ? `${pad.paper} প্রেসক্রিপশন` : "এখনো সেভ করা প্রেসক্রিপশন নেই"} · <Link href="/dashboard/share#pad">ডিজাইন বদলান</Link></span>
        <PrintButton />
      </div>
      {auto && <script dangerouslySetInnerHTML={{ __html: "window.addEventListener('load',()=>setTimeout(()=>window.print(),400))" }} />}
      <div className="pr-desk"><div className="pr-paper"><RxPad s={pad} d={data} /></div></div>
    </>
  );
}
