import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { requireStaff } from "@/lib/auth";
import { patientCode } from "@/lib/booking";
import { addDays, bn, formatDateBn, today } from "@/lib/time";
import { closeFollowUp, resendReminder } from "./actions";

export const metadata = { title: "ফলোআপ" };
export const dynamic = "force-dynamic";

const daysLate = (due: string, t: string) => Math.round((Date.parse(t) - Date.parse(due)) / 86400000);

export default async function FollowUpsPage() {
  const s = await requireStaff();
  const t = today();
  const { followUps, patients, patientAccounts } = schema;
  const base = () =>
    db.select({ fu: followUps, name: patients.name, number: patients.number, phone: patientAccounts.phone, patientId: patients.id })
      .from(followUps)
      .innerJoin(patients, eq(patients.id, followUps.patientId))
      .innerJoin(patientAccounts, eq(patientAccounts.id, patients.accountId));

  const weekAgo = addDays(t, -7);
  const [missed, upcoming, [stats]] = await Promise.all([
    base().where(and(eq(followUps.doctorId, s.doctorId), eq(followUps.status, "MISSED"))).orderBy(desc(followUps.dueDate)).limit(100),
    base().where(and(eq(followUps.doctorId, s.doctorId), inArray(followUps.status, ["PENDING", "REMINDED"]), gte(followUps.dueDate, t))).orderBy(asc(followUps.dueDate)).limit(50),
    db.select({
      total: sql<number>`count(*)::int`,
      booked: sql<number>`count(*) filter (where ${followUps.status} = 'BOOKED')::int`,
    }).from(followUps).where(and(eq(followUps.doctorId, s.doctorId), gte(followUps.dueDate, weekAgo), sql`${followUps.dueDate} <= ${t}`)),
  ]);

  return (
    <>
      <div className="stack-sm" style={{ gap: 0 }}>
        <h1>ফলোআপ</h1>
        <span className="muted">রিমাইন্ডার নিজে থেকেই যায়। যারা মেসেজ পেয়েও আসেননি, তারা নিচের তালিকায়।</span>
      </div>
      <div className="grid">
        <div className="card"><span className="muted small">গত ৭ দিনের ফলোআপ</span><div className="big-num">{bn(stats.total)}</div></div>
        <div className="card"><span className="muted small">সিরিয়াল নিয়েছেন</span><div className="big-num" style={{ color: "var(--teal)" }}>{bn(stats.booked)}</div></div>
        <div className="card card-warn"><span className="small" style={{ color: "var(--orange-ink)" }}>মিস করেছেন (মোট)</span><div className="big-num" style={{ color: "var(--orange)" }}>{bn(missed.length)}</div></div>
      </div>

      <h2>ফলোআপ মিস</h2>
      <div className="table-wrap"><table>
        <thead><tr><th>রোগী</th><th>ফলোআপের তারিখ</th><th>শেষ রিমাইন্ডার</th><th>পদক্ষেপ</th></tr></thead>
        <tbody>
          {missed.length === 0 && <tr><td colSpan={4} className="muted">কেউ মিস করেননি।</td></tr>}
          {missed.map((r) => (
            <tr key={r.fu.id}>
              <td><Link href={`/dashboard/patients/${r.patientId}`} style={{ color: "inherit", fontWeight: 700 }}>{r.name}</Link><div className="muted small">{patientCode(r.number)} · {r.phone}</div></td>
              <td>{formatDateBn(r.fu.dueDate, false)} <span className="small" style={{ color: "var(--red)", fontWeight: 600 }}>{bn(daysLate(r.fu.dueDate, t))} দিন দেরি</span></td>
              <td className="muted">{r.fu.remindedAt ? "পাঠানো হয়েছে" : "—"}</td>
              <td><div className="row">
                <a className="btn" style={{ minHeight: 36 }} href={`tel:${r.phone}`}>কল</a>
                <form action={resendReminder}><input type="hidden" name="id" value={r.fu.id} /><button className="btn btn-primary" style={{ minHeight: 36 }}>আবার পাঠান</button></form>
                <form action={closeFollowUp}><input type="hidden" name="id" value={r.fu.id} /><button className="btn" style={{ minHeight: 36 }}>বন্ধ করুন</button></form>
              </div></td>
            </tr>
          ))}
        </tbody>
      </table></div>

      <h2>আসন্ন ফলোআপ</h2>
      <div className="table-wrap"><table>
        <thead><tr><th>রোগী</th><th>তারিখ</th><th>অবস্থা</th></tr></thead>
        <tbody>
          {upcoming.length === 0 && <tr><td colSpan={3} className="muted">নেই।</td></tr>}
          {upcoming.map((r) => (
            <tr key={r.fu.id}><td>{r.name} <span className="muted small">{patientCode(r.number)}</span></td><td>{formatDateBn(r.fu.dueDate)}</td>
              <td>{r.fu.status === "REMINDED" ? <span className="badge badge-teal">রিমাইন্ডার গেছে</span> : <span className="badge">রিমাইন্ডার যাবে আগের দিন</span>}</td></tr>
          ))}
        </tbody>
      </table></div>
    </>
  );
}
