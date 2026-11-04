import { and, desc, eq, ne } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { StatusBadge } from "@/components/StatusBadge";
import { VitalsPanel } from "@/components/Vitals";
import { canSeeRx } from "@/lib/access";
import { requireStaff } from "@/lib/auth";
import { toRow, vitalsForDoctor } from "@/lib/vitals";
import { addVitalForPatient } from "../actions";
import { patientCode } from "@/lib/booking";
import { bn, formatDateBn, thisYear } from "@/lib/time";

const FU = { PENDING: "আসন্ন", REMINDED: "রিমাইন্ডার গেছে", BOOKED: "সিরিয়াল নিয়েছেন", MISSED: "মিস", CANCELLED: "বাতিল" } as const;

export default async function PatientProfile({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireStaff();
  const { id } = await params;
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
  const [vs, fus, family, vit] = await Promise.all([
    db.select().from(visits).where(and(eq(visits.patientId, id), eq(visits.doctorId, s.doctorId))).orderBy(desc(visits.createdAt)),
    db.select().from(followUps).where(and(eq(followUps.patientId, id), eq(followUps.doctorId, s.doctorId))).orderBy(desc(followUps.dueDate)),
    db.select({ id: patients.id, name: patients.name, number: patients.number }).from(patients).where(and(eq(patients.accountId, row.accountId), ne(patients.id, id))),
    vitalsForDoctor(s.doctorId, id),
  ]);
  const vrows = vit.map((v) => toRow(v, v.source === "PATIENT" ? "রোগী নিজে" : v.source === "ASSISTANT" ? "অ্যাসিস্ট্যান্ট" : "ডাক্তার"));
  const p = row.p;
  const age = p.birthYear ? thisYear() - p.birthYear : null;
  const visitByBooking = new Map(vs.filter((v) => v.bookingId).map((v) => [v.bookingId!, v]));

  return (
    <>
      <Link href="/dashboard/patients" className="small">← রোগী খোঁজা</Link>
      <div className="card row" style={{ gap: 18 }}>
        <div aria-hidden style={{ width: 64, height: 64, borderRadius: 32, background: "var(--teal-soft)", color: "var(--teal)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 22 }}>{p.name.slice(0, 2)}</div>
        <div className="stack-sm" style={{ flex: 1, gap: 2 }}>
          <h1 style={{ fontSize: 24 }}>{p.name}</h1>
          <span className="muted">{patientCode(p.number)} · {row.phone}{p.gender ? ` · ${p.gender}` : ""}{age ? ` · ${bn(age)} বছর` : ""}</span>
          {family.length > 0 && <span className="small">একই নাম্বারে: {family.map((f) => `${f.name} (${patientCode(f.number)})`).join(", ")}</span>}
        </div>
        <div className="stack-sm"><span className="muted small">মোট ভিজিট</span><span className="big-num">{bn(hist.filter((h) => h.b.status === "DONE").length)}</span></div>
      </div>

      {fus.length > 0 && (
        <div className="card stack-sm">
          <h2>ফলোআপ</h2>
          {fus.map((f) => <span key={f.id}>{formatDateBn(f.dueDate)} · <strong>{FU[f.status]}</strong></span>)}
        </div>
      )}

      <section className="card stack" aria-label="স্বাস্থ্যের রিডিং">
        <div className="row-sb"><h2>প্রেসার, সুগার ও ওজন</h2><span className="small muted">তারিখ অনুযায়ী — রোগীর নিজের অ্যাকাউন্টেও দেখাবে</span></div>
        <VitalsPanel rows={vrows} action={addVitalForPatient.bind(null, id)} />
      </section>

      <div className="card stack">
        <h2>ভিজিটের ইতিহাস</h2>
        {!rx && <p className="alert alert-error small">প্রেসক্রিপশন দেখার অনুমতি নেই — ডাক্তার &quot;অ্যাসিস্ট্যান্ট&quot; পেজ থেকে অনুমতি দিলে দেখা যাবে।</p>}
        {hist.map(({ b, chamberName }) => {
          const v = visitByBooking.get(b.id);
          return (
            <div key={b.id} className="row" style={{ borderTop: "1px solid var(--row-line)", paddingTop: 12, alignItems: "flex-start" }}>
              <div className="stack-sm" style={{ width: 160, gap: 0 }}>
                <strong>{formatDateBn(b.date, false)} {bn(b.date.slice(0, 4))}</strong>
                <span className="muted small">{chamberName} · সিরিয়াল {bn(b.serialNo)}</span>
              </div>
              <div className="stack-sm" style={{ flex: 1, minWidth: 240, gap: 2 }}>
                {v && rx ? (
                  <>
                    <strong>{v.diagnosis || v.complaint || "প্রেসক্রিপশন"}</strong>
                    <span className="muted small">{v.medicines.map((m) => `${m.name} ${m.dose}`).join(" · ") || "ওষুধ নেই"}</span>
                    {v.advice && <span className="small">{v.advice}</span>}
                  </>
                ) : <span style={{ alignSelf: "flex-start" }}><StatusBadge status={b.status} /></span>}
              </div>
              {rx && (b.status === "DONE" || b.status === "IN_PROGRESS") && <Link className="btn" style={{ minHeight: 36 }} href={`/dashboard/visit/${b.id}`}>{v ? "প্রেসক্রিপশন দেখুন" : "প্রেসক্রিপশন লিখুন"}</Link>}
            </div>
          );
        })}
      </div>
    </>
  );
}
