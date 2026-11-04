import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { ChamberTabs } from "@/components/ChamberTabs";
import { requireStaff } from "@/lib/auth";
import { normalizePhone, patientCode } from "@/lib/booking";
import { doctorChambers, pickChamber } from "@/lib/chambers";
import { bn, formatDateBn, today, thisYear } from "@/lib/time";
import { QuickSerialButton, WalkInForm } from "./WalkInForm";

export const metadata = { title: "রোগী খোঁজা" };
export const dynamic = "force-dynamic";

const toAscii = (s: string) => s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));

/**
 * রোগী খোঁজার নিয়ম (PRD §১৪): মোবাইল নাম্বার (পুরো বা অংশ), নাম, রোগী আইডি (P-10234) বা আজকের সিরিয়াল।
 * ফলাফলে শুধু এই ডাক্তারের নিজের রোগী।
 */
async function search(doctorId: string, chamberId: string, raw: string) {
  const q = toAscii(raw.trim());
  if (!q) return [];
  const { patients, patientAccounts, bookings } = schema;
  const conds = [];
  const idMatch = q.match(/^p-?(\d+)$/i);
  if (idMatch) conds.push(eq(patients.number, Number(idMatch[1]) - 10000));
  const full = normalizePhone(q);
  if (full) conds.push(eq(patientAccounts.phone, full));
  else if (/^\d{4,}$/.test(q)) conds.push(ilike(patientAccounts.phone, `%${q}%`));
  if (/^\d{1,3}$/.test(q)) {
    const todays = db.select({ id: bookings.patientId }).from(bookings)
      .where(and(eq(bookings.chamberId, chamberId), eq(bookings.date, today()), eq(bookings.serialNo, Number(q))));
    conds.push(inArray(patients.id, todays));
  }
  if (!/^\d/.test(q) && q.length >= 2) conds.push(ilike(patients.name, `%${q}%`));
  if (conds.length === 0) return [];

  const seenByDoctor = db.selectDistinct({ id: bookings.patientId }).from(bookings).where(eq(bookings.doctorId, doctorId));
  const lastVisit = sql<string | null>`(select max(b.date) from bookings b where b.patient_id = ${patients.id} and b.doctor_id = ${doctorId} and b.status = 'DONE')`;
  return db
    .select({ id: patients.id, number: patients.number, name: patients.name, gender: patients.gender, birthYear: patients.birthYear, phone: patientAccounts.phone, lastVisit })
    .from(patients)
    .innerJoin(patientAccounts, eq(patientAccounts.id, patients.accountId))
    // শুধু এই ডাক্তারের কাছে আগে এসেছেন এমন রোগী — অন্য ডাক্তারের রোগীর তথ্য কখনো দেখানো হয় না।
    // নতুন রোগী পুরনো নাম্বারে এলে ফর্মে যোগ করলেই একই নাম+নাম্বারের প্রোফাইল আবার ব্যবহার হয়।
    .where(and(or(...conds), inArray(patients.id, seenByDoctor)))
    .orderBy(desc(patients.createdAt))
    .limit(20);
}

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string; chamber?: string }> }) {
  const s = await requireStaff();
  const sp = await searchParams;
  const list = await doctorChambers(s.doctorId);
  const chamber = pickChamber(list, sp.chamber);
  if (!chamber) return <p>আগে <Link href="/dashboard/chambers">চেম্বার যোগ করুন</Link>।</p>;
  const q = sp.q ?? "";
  const results = await search(s.doctorId, chamber.id, q);
  const year = thisYear();
  const phoneGuess = normalizePhone(toAscii(q)) ?? undefined;

  return (
    <>
      <h1>রোগী খুঁজুন বা যোগ করুন</h1>
      <ChamberTabs chambers={list} current={chamber.id} base="/dashboard/patients" />
      <form role="search" className="row" style={{ maxWidth: 720 }}>
        <input type="hidden" name="chamber" value={chamber.id} />
        <label htmlFor="q" style={{ position: "absolute", left: -9999 }}>খুঁজুন</label>
        <input id="q" name="q" className="input" defaultValue={q} autoFocus placeholder="মোবাইল নাম্বার, নাম, রোগী আইডি (P-10234) বা আজকের সিরিয়াল" style={{ flex: 1, fontSize: 18, minHeight: 56, border: "2px solid var(--teal)" }} />
        <button className="btn btn-primary btn-big">খুঁজুন</button>
      </form>

      <div className="row" style={{ alignItems: "flex-start", gap: 20 }}>
        <div className="stack" style={{ flex: "3 1 420px", minWidth: 0 }}>
          {q && <span className="muted">{bn(results.length)}টি প্রোফাইল পাওয়া গেছে</span>}
          {results.map((p) => (
            <div key={p.id} className="card row" style={{ alignItems: "center" }}>
              <div className="stack-sm" style={{ flex: 1, minWidth: 200, gap: 0 }}>
                <Link href={`/dashboard/patients/${p.id}`} style={{ fontSize: 17, fontWeight: 700, color: "inherit" }}>{p.name}</Link>
                <span className="muted small">
                  {patientCode(p.number)} · {p.phone}
                  {p.birthYear ? ` · ${bn(year - p.birthYear)} বছর` : ""}
                  {p.gender ? ` · ${p.gender}` : ""}
                  {p.lastVisit ? ` · শেষ ভিজিট ${formatDateBn(p.lastVisit, false)}` : " · এই ডাক্তারের কাছে নতুন"}
                </span>
              </div>
              <QuickSerialButton chamberId={chamber.id} patientId={p.id} />
            </div>
          ))}
        </div>
        <div style={{ flex: "2 1 300px", minWidth: 0 }}>
          <WalkInForm key={q} chamberId={chamber.id} phone={phoneGuess} />
        </div>
      </div>
    </>
  );
}
