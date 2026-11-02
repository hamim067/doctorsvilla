import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ChamberTabs } from "@/components/ChamberTabs";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { requireStaff } from "@/lib/auth";
import { patientCode } from "@/lib/booking";
import { doctorChambers, pickChamber } from "@/lib/chambers";
import { liveState } from "@/lib/queue";
import { bn, formatDateBn, today } from "@/lib/time";
import { queueAction, requeueAction } from "./actions";

export const metadata = { title: "সিরিয়াল কিউ" };
export const dynamic = "force-dynamic";

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ chamber?: string }> }) {
  const s = await requireStaff();
  const list = await doctorChambers(s.doctorId);
  const chamber = pickChamber(list, (await searchParams).chamber);
  if (!chamber) return <p>আগে <Link href="/dashboard/chambers">চেম্বার যোগ করুন</Link>।</p>;
  const date = today();
  const st = (await liveState(chamber.id, date))!;
  const cur = st.current;
  const nextUp = st.waiting[0];

  return (
    <>
      <AutoRefresh seconds={10} />
      <div className="row between">
        <div className="stack-sm" style={{ gap: 0 }}>
          <span className="muted">{chamber.name} · {formatDateBn(date)}</span>
          <h1>সিরিয়াল কিউ</h1>
        </div>
        <div className="row">
          <a className="btn" href={`/tv/${chamber.tvToken}`} target="_blank" rel="noreferrer">টিভি ডিসপ্লে ↗</a>
          <Link className="btn btn-primary" href={`/dashboard/patients?chamber=${chamber.id}`}>+ সরাসরি আসা রোগী</Link>
        </div>
      </div>
      <ChamberTabs chambers={list} current={chamber.id} base="/dashboard/queue" />

      <section className="now-panel" aria-live="polite">
        <div className="stack-sm" style={{ alignItems: "center", minWidth: 110, gap: 0 }}>
          <span style={{ color: "#c9e7e0" }}>এখন চলছে</span>
          <span className="num">{cur ? bn(cur.serialNo) : "—"}</span>
        </div>
        <div className="stack-sm" style={{ flex: 1, minWidth: 200, gap: 2 }}>
          {cur ? (
            <>
              <strong style={{ fontSize: 22 }}>{cur.patientName}</strong>
              <span style={{ color: "#c9e7e0" }}>{cur.type === "FOLLOW_UP" ? "ফলোআপ" : "নতুন"} রোগী · {patientCode(cur.patientNumber)} · {cur.source === "ONLINE" ? "অনলাইন" : "সরাসরি"}</span>
              <Link href={`/dashboard/visit/${cur.id}`} style={{ color: "#fff", textDecoration: "underline" }}>প্রেসক্রিপশন লিখুন →</Link>
            </>
          ) : (
            <span style={{ fontSize: 18 }}>{nextUp ? `পরের রোগী: সিরিয়াল ${bn(nextUp.serialNo)} — ${nextUp.patientName}` : "অপেক্ষমাণ কেউ নেই"}</span>
          )}
        </div>
        <form action={queueAction} className="row">
          <input type="hidden" name="chamberId" value={chamber.id} />
          {cur ? (
            <>
              <SubmitButton className="btn btn-big" name="action" value="absent" pendingText="…">অনুপস্থিত</SubmitButton>
              <SubmitButton className="btn btn-big solid" name="action" value="done" pendingText="…">সম্পন্ন · পরের জনকে ডাকুন</SubmitButton>
            </>
          ) : (
            <SubmitButton className="btn btn-big solid" name="action" value="start" disabled={!nextUp} pendingText="…">পরের জনকে ডাকুন</SubmitButton>
          )}
        </form>
      </section>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <div className="card"><span className="muted small">মোট</span><div className="big-num">{bn(st.total)}</div></div>
        <div className="card"><span className="muted small">সম্পন্ন</span><div className="big-num" style={{ color: "var(--teal)" }}>{bn(st.done)}</div></div>
        <div className="card"><span className="muted small">অপেক্ষমাণ</span><div className="big-num">{bn(st.waiting.length)}</div></div>
        <div className="card"><span className="muted small">গড় সময়/রোগী</span><div className="big-num">{bn(st.avg)}<span className="small"> মিনিট</span></div></div>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>সিরিয়াল</th><th>রোগী</th><th>ধরন</th><th>বুকিং</th><th>অবস্থা</th><th></th></tr></thead>
          <tbody>
            {st.rows.length === 0 && <tr><td colSpan={6} className="muted">আজ এখনো কোনো সিরিয়াল নেই।</td></tr>}
            {st.rows.map((r) => (
              <tr key={r.id} className={r.status === "IN_PROGRESS" ? "live" : undefined}>
                <td><strong>{bn(r.serialNo)}</strong> <span className="muted small">{r.code}</span></td>
                <td><Link href={`/dashboard/patients/${r.patientId}`} style={{ color: "inherit" }}>{r.patientName}</Link> <span className="muted small">{patientCode(r.patientNumber)}</span></td>
                <td>{r.type === "FOLLOW_UP" ? <span className="badge badge-blue">ফলোআপ</span> : "নতুন"}</td>
                <td className="muted">{r.source === "ONLINE" ? "অনলাইন" : "সরাসরি"}</td>
                <td><StatusBadge status={r.status} /></td>
                <td>
                  {r.status === "ABSENT" && (
                    <form action={requeueAction}><input type="hidden" name="bookingId" value={r.id} /><button className="btn" style={{ minHeight: 36 }}>আবার লাইনে</button></form>
                  )}
                  {(r.status === "DONE" || r.status === "IN_PROGRESS") && <Link className="btn" style={{ minHeight: 36 }} href={`/dashboard/visit/${r.id}`}>প্রেসক্রিপশন</Link>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
