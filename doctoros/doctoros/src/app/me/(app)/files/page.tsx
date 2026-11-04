import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { patientCode } from "@/lib/booking";
import { familyOf, requirePatient } from "@/lib/patient-auth";
import { bn, dateDhaka, formatDateBn } from "@/lib/time";

export const metadata = { title: "মেডিকেল ফাইল" };
export const dynamic = "force-dynamic";

export default async function MyFiles({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const s = await requirePatient();
  const fam = await familyOf(s.accountId);
  const { p } = await searchParams;
  const selected = fam.find((x) => x.id === p);
  const ids = selected ? [selected.id] : fam.map((x) => x.id);
  const visits = ids.length
    ? await db.select({ v: schema.visits, doctorName: schema.doctors.name, degrees: schema.doctors.degrees, patientName: schema.patients.name })
        .from(schema.visits)
        .innerJoin(schema.doctors, eq(schema.doctors.id, schema.visits.doctorId))
        .innerJoin(schema.patients, eq(schema.patients.id, schema.visits.patientId))
        .where(inArray(schema.visits.patientId, ids))
        .orderBy(desc(schema.visits.createdAt))
        .limit(50)
    : [];

  return (
    <div className="stack">
      <h1>মেডিকেল ফাইল</h1>
      {fam.length > 1 && (
        <nav className="me-chips" aria-label="সদস্য">
          <Link href="/me/files" className={!selected ? "on" : ""}>সব</Link>
          {fam.map((m) => <Link key={m.id} href={`/me/files?p=${m.id}`} className={selected?.id === m.id ? "on" : ""}>{m.name}</Link>)}
        </nav>
      )}
      {visits.length === 0 && <div className="me-card muted">এখনো কোনো প্রেসক্রিপশন নেই। ডাক্তার ডিজিটাল প্রেসক্রিপশন লিখলে এখানে চলে আসবে।</div>}
      {visits.map(({ v, doctorName, degrees, patientName }, i) => (
        <article key={v.id} className="me-card stack-sm">
          <div className="row-sb">
            <span className={`badge ${i === 0 ? "badge-teal" : ""}`}>প্রেসক্রিপশন{i === 0 ? " · সর্বশেষ" : ""}</span>
            <span className="small muted">{formatDateBn(dateDhaka(v.createdAt), false)} {bn(dateDhaka(v.createdAt).slice(0, 4))}</span>
          </div>
          <b style={{ fontSize: 17 }}>{doctorName} <span className="small muted" style={{ fontWeight: 400 }}>{degrees}</span></b>
          <span className="small muted">রোগী: {patientName}</span>
          {(v.diagnosis || v.complaint) && <span><b>রোগ নির্ণয়:</b> {v.diagnosis || v.complaint}</span>}
          {v.medicines.length > 0 && (
            <div className="me-rx">
              {v.medicines.map((m, j) => (
                <div key={j} className="row-sb"><b>{m.name}</b><span className="muted small">{[m.dose, m.when, m.days].filter(Boolean).join(" · ")}</span></div>
              ))}
            </div>
          )}
          {v.advice && <span className="small"><b>পরামর্শ:</b> {v.advice}</span>}
          {v.followUpDate && <span className="small" style={{ color: "var(--orange-ink)", fontWeight: 600 }}>ফলোআপ: {formatDateBn(v.followUpDate)}</span>}
        </article>
      ))}
      <p className="small muted">টেস্ট রিপোর্টের ছবি আপলোডের সুবিধা শীঘ্রই আসছে। {fam.length > 0 && `রোগী আইডি: ${fam.map((m) => `${m.name} ${patientCode(m.number)}`).join(", ")}`}</p>
    </div>
  );
}
