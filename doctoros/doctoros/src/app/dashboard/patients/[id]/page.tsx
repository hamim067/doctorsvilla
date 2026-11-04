import { and, desc, eq, ne, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icons";
import { MedsToday } from "@/components/MedsToday";
import { StatusBadge } from "@/components/StatusBadge";
import { VitalsPanel } from "@/components/Vitals";
import { canSeeRx } from "@/lib/access";
import { requireStaff } from "@/lib/auth";
import { patientCode } from "@/lib/booking";
import { doctorChambers } from "@/lib/chambers";
import { currentMeds, splitList } from "@/lib/meds";
import { addDays, bn, dateDhaka, formatDateBn, thisYear, today } from "@/lib/time";
import { toRow, vitalsForDoctor } from "@/lib/vitals";
import { addVitalForPatient, quickBook, saveHealthInfo } from "../actions";
import { HealthInfo, PatientActions } from "./PatientActions";
import "../patients.css";

export const dynamic = "force-dynamic";
const FU = { PENDING: "আসন্ন", REMINDED: "রিমাইন্ডার গেছে", BOOKED: "সিরিয়াল নিয়েছেন", MISSED: "মিস", CANCELLED: "বাতিল" } as const;
const TABS = [
  { k: "summary", label: "সারাংশ", icon: "layout" },
  { k: "rx", label: "প্রেসক্রিপশন", icon: "pill" },
  { k: "health", label: "প্রেসার ও সুগার", icon: "heart" },
  { k: "serial", label: "সিরিয়াল", icon: "calendar" },
] as const;
type Tab = (typeof TABS)[number]["k"];

/** রোগীর কার্ড — শুধু এই ডাক্তারের নিজের রোগী; অ্যাসিস্ট্যান্ট প্রেসক্রিপশন দেখেন শুধু অনুমতি থাকলে */
export default async function PatientCard({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const s = await requireStaff();
  const { id } = await params;
  const wanted = (await searchParams).tab;
  const tab: Tab = TABS.find((t) => t.k === wanted)?.k ?? "summary";
  const { patients, patientAccounts, bookings, visits, followUps } = schema;
  const [row] = await db.select({ p: patients, phone: patientAccounts.phone, accountId: patientAccounts.id })
    .from(patients).innerJoin(patientAccounts, eq(patientAccounts.id, patients.accountId)).where(eq(patients.id, id)).limit(1);
  if (!row) notFound();

  const hist = await db.select({ b: bookings, chamberName: schema.chambers.name })
    .from(bookings).innerJoin(schema.chambers, eq(schema.chambers.id, bookings.chamberId))
    .where(and(eq(bookings.patientId, id), eq(bookings.doctorId, s.doctorId))).orderBy(desc(bookings.date), desc(bookings.serialNo));
  // অন্য ডাক্তারের রোগীর তথ্য দেখা যাবে না
  if (hist.length === 0) notFound();

  const rx = await canSeeRx(s);
  const [vs, fus, family, vit, chambers] = await Promise.all([
    db.select({ v: visits, date: bookings.date }).from(visits).leftJoin(bookings, eq(bookings.id, visits.bookingId))
      .where(and(eq(visits.patientId, id), eq(visits.doctorId, s.doctorId))).orderBy(desc(visits.createdAt)),
    db.select().from(followUps).where(and(eq(followUps.patientId, id), eq(followUps.doctorId, s.doctorId))).orderBy(desc(followUps.dueDate)),
    // পরিবারের যারা এই ডাক্তারের কাছে এসেছেন শুধু তারাই — অন্যদের নামও দেখানো হয় না
    db.select({ id: patients.id, name: patients.name, number: patients.number }).from(patients).where(and(eq(patients.accountId, row.accountId), ne(patients.id, id),
      sql`exists (select 1 from bookings b where b.patient_id = ${patients.id} and b.doctor_id = ${s.doctorId})`)),
    vitalsForDoctor(s.doctorId, id),
    doctorChambers(s.doctorId),
  ]);
  const p = row.p;
  const t = today();
  const age = p.birthYear ? thisYear() - p.birthYear : null;
  const visitRows = vs.map(({ v, date }) => ({ ...v, date: date ?? dateDhaka(v.createdAt) }));
  const visitByBooking = new Map(visitRows.filter((v) => v.bookingId).map((v) => [v.bookingId!, v]));
  const meds = rx ? currentMeds(visitRows.map((v) => ({ date: v.date, medicines: v.medicines })), t) : [];
  const vrows = vit.map((v) => toRow(v, v.source === "PATIENT" ? "রোগী নিজে" : v.source === "ASSISTANT" ? "অ্যাসিস্ট্যান্ট" : "ডাক্তার"));
  const lastV = vrows[0];
  const lastDone = hist.find((h) => h.b.status === "DONE");
  const lastVisit = visitRows[0];
  const upcoming = hist.filter((h) => h.b.date >= t && (h.b.status === "WAITING" || h.b.status === "IN_PROGRESS"));
  const allergies = splitList(p.allergies), conditions = splitList(p.conditions);

  return (
    <div className="pc">
      <Link href="/dashboard/patients" className="small">← রোগী খোঁজা</Link>

      <section className="pc-head">
        <span className="pc-av" aria-hidden>{p.name.slice(0, 1)}</span>
        <div className="col grow" style={{ gap: 2, minWidth: 0 }}>
          <h1>{p.name}</h1>
          <span className="pc-meta">{patientCode(p.number)} · {row.phone}{p.gender ? ` · ${p.gender}` : ""}{age ? ` · ${bn(age)} বছর` : ""}</span>
          {family.length > 0 && <span className="small muted">একই নম্বরে: {family.map((f) => `${f.name} (${patientCode(f.number)})`).join(", ")}</span>}
        </div>
        <div className="pc-stat"><span>মোট ভিজিট</span><b>{bn(hist.filter((h) => h.b.status === "DONE").length)}</b></div>
      </section>

      <HealthInfo allergies={allergies} conditions={conditions} action={saveHealthInfo.bind(null, id)} />

      <PatientActions chambers={chambers.map((c) => ({ id: c.id, name: c.name, city: c.city }))} action={quickBook.bind(null, id)} canRx={rx} minDate={addDays(t, 1)} />

      <nav className="pc-tabs" aria-label="রোগীর তথ্য">
        {TABS.map((x) => (
          <Link key={x.k} href={`?tab=${x.k}`} className={tab === x.k ? "on" : ""} aria-current={tab === x.k ? "page" : undefined} scroll={false}>
            <Icon name={x.icon} size={18} />{x.label}
          </Link>
        ))}
      </nav>

      {tab === "summary" && (
        <div className="pc-grid">
          <section className="card stack-sm">
            <h2><Icon name="pill" size={20} /> এখন যে ওষুধ চলছে</h2>
            {rx ? <MedsToday meds={meds} empty="এখন চলমান কোনো ওষুধ নেই (আপনার প্রেসক্রিপশন অনুযায়ী)।" /> : <p className="alert alert-error small">প্রেসক্রিপশন দেখার অনুমতি নেই</p>}
          </section>
          <div className="stack">
            <section className="card stack-sm">
              <h2><Icon name="heart" size={20} /> সর্বশেষ প্রেসার ও সুগার</h2>
              {lastV ? (
                <div className="pc-vit">
                  {lastV.sys !== null && <span><small>প্রেসার</small><b>{bn(lastV.sys)}/{bn(lastV.dia!)}</b></span>}
                  {lastV.sugar !== null && <span><small>সুগার</small><b>{bn(lastV.sugar)}</b></span>}
                  {lastV.weight !== null && <span><small>ওজন</small><b>{bn(lastV.weight)} kg</b></span>}
                  <em className="small muted">{formatDateBn(lastV.date)} · {lastV.by}</em>
                </div>
              ) : <p className="muted small">এখনো কোনো রিডিং নেই। <Link href="?tab=health">যোগ করুন →</Link></p>}
            </section>
            <section className="card stack-sm">
              <h2><Icon name="calendar" size={20} /> শেষ ভিজিট ও পরের দিন</h2>
              {lastDone ? <span>শেষ দেখা: <b>{formatDateBn(lastDone.b.date)}</b> · {lastDone.chamberName}</span> : <span className="muted">এখনো ভিজিট সম্পন্ন হয়নি</span>}
              {rx && lastVisit && (lastVisit.diagnosis || lastVisit.complaint) && <span>রোগ নির্ণয়: <b>{lastVisit.diagnosis || lastVisit.complaint}</b></span>}
              {upcoming.map((u) => <span key={u.b.id} className="badge badge-teal" style={{ alignSelf: "flex-start" }}>আসন্ন: {formatDateBn(u.b.date)} · সিরিয়াল {bn(u.b.serialNo)}</span>)}
              {fus.filter((f) => f.status !== "CANCELLED" && f.status !== "BOOKED").slice(0, 1).map((f) => <span key={f.id} className="small">আবার দেখানোর দিন: <b>{formatDateBn(f.dueDate)}</b> ({FU[f.status]})</span>)}
            </section>
          </div>
        </div>
      )}

      {tab === "rx" && (
        <section className="stack">
          {!rx && <p className="alert alert-error">প্রেসক্রিপশন দেখার অনুমতি নেই — ডাক্তার &quot;অ্যাসিস্ট্যান্ট&quot; পেজ থেকে অনুমতি দিলে দেখা যাবে।</p>}
          {rx && visitRows.length === 0 && <p className="card muted">এখনো কোনো প্রেসক্রিপশন নেই।</p>}
          {rx && visitRows.map((v) => (
            <article key={v.id} className="card pc-rx">
              <div className="row-sb">
                <b>{formatDateBn(v.date)} {bn(v.date.slice(0, 4))}</b>
                {v.bookingId && <Link className="btn btn-sm2" href={`/dashboard/visit/${v.bookingId}`}>খুলুন</Link>}
              </div>
              {(v.diagnosis || v.complaint) && <span><b>রোগ নির্ণয়:</b> {v.diagnosis || v.complaint}</span>}
              {v.medicines.length > 0 && <ul className="pc-meds">{v.medicines.map((m, i) => <li key={i}><b>{m.name}</b><span>{[m.dose, m.when, m.days].filter(Boolean).join(" · ")}</span></li>)}</ul>}
              {v.advice && <span className="small"><b>পরামর্শ:</b> {v.advice}</span>}
            </article>
          ))}
        </section>
      )}

      {tab === "health" && (
        <section className="card stack" aria-label="স্বাস্থ্যের রিডিং">
          <div className="row-sb"><h2>প্রেসার, সুগার ও ওজন</h2><span className="small muted">তারিখ অনুযায়ী — রোগীর নিজের অ্যাকাউন্টেও দেখাবে</span></div>
          <VitalsPanel rows={vrows} action={addVitalForPatient.bind(null, id)} />
        </section>
      )}

      {tab === "serial" && (
        <section className="card stack">
          <h2>সিরিয়ালের ইতিহাস</h2>
          {hist.map(({ b, chamberName }) => {
            const v = visitByBooking.get(b.id);
            return (
              <div key={b.id} className="pc-hist">
                <div className="col" style={{ gap: 0, minWidth: 0 }}>
                  <strong>{formatDateBn(b.date, false)} {bn(b.date.slice(0, 4))}</strong>
                  <span className="muted small">{chamberName} · সিরিয়াল {bn(b.serialNo)}{b.feeWaived ? " · ফ্রি" : ""}</span>
                  {v && rx && <span className="small">{v.diagnosis || v.complaint || "প্রেসক্রিপশন আছে"}</span>}
                </div>
                <span className="row" style={{ gap: 8 }}>
                  <StatusBadge status={b.status} />
                  {rx && (b.status === "DONE" || b.status === "IN_PROGRESS") && <Link className="btn btn-sm2" href={`/dashboard/visit/${b.id}`}>{v ? "প্রেসক্রিপশন" : "লিখুন"}</Link>}
                </span>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
