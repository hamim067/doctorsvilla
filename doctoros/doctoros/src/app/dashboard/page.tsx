import { and, eq, gte, sql } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ChamberTabs } from "@/components/ChamberTabs";
import { StatusBadge } from "@/components/StatusBadge";
import { requireStaff } from "@/lib/auth";
import { patientCode } from "@/lib/booking";
import { doctorChambers, pickChamber } from "@/lib/chambers";
import { liveState } from "@/lib/queue";
import { bn, formatDateBn, today } from "@/lib/time";

export const metadata = { title: "ড্যাশবোর্ড" };
export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ chamber?: string; denied?: string }> }) {
  const s = await requireStaff();
  const sp = await searchParams;
  const list = await doctorChambers(s.doctorId);
  const chamber = pickChamber(list, sp.chamber);
  if (!chamber) {
    return (
      <div className="card stack">
        <h1>স্বাগতম!</h1>
        <p>শুরু করতে আপনার প্রথম চেম্বার যোগ করুন।</p>
        <div><Link className="btn btn-primary" href="/dashboard/chambers">চেম্বার যোগ করুন</Link></div>
      </div>
    );
  }
  const t = today();
  const st = (await liveState(chamber.id, t))!;
  const monthStart = `${t.slice(0, 7)}-01`;
  const [[missed], [sms], [income]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(schema.followUps).where(and(eq(schema.followUps.doctorId, s.doctorId), eq(schema.followUps.status, "MISSED"))),
    // মাসে কত এসএমএস গেল — প্যাকেজের ফ্রি সীমা মেলানোর জন্য (PRD §১৭)
    db.select({ n: sql<number>`count(*)::int` }).from(schema.messageLogs).where(and(eq(schema.messageLogs.doctorId, s.doctorId), eq(schema.messageLogs.channel, "sms"), gte(schema.messageLogs.createdAt, new Date(`${monthStart}T00:00:00+06:00`)))),
    db.select({ n: sql<number>`coalesce(sum(case when ${schema.bookings.type} = 'FOLLOW_UP' then ${schema.chambers.feeFollowUp} else ${schema.chambers.feeNew} end), 0)::int` })
      .from(schema.bookings).innerJoin(schema.chambers, eq(schema.chambers.id, schema.bookings.chamberId))
      .where(and(eq(schema.bookings.chamberId, chamber.id), eq(schema.bookings.date, t), eq(schema.bookings.status, "DONE"))),
  ]);
  const online = st.rows.filter((r) => r.source === "ONLINE").length;
  const upcoming = [st.current, ...st.waiting].filter(Boolean).slice(0, 6);

  return (
    <>
      <AutoRefresh seconds={20} />
      {sp.denied && <p className="alert alert-error">এই পেজ শুধু ডাক্তার নিজে দেখতে পারবেন।</p>}
      <div className="row between">
        <div className="stack-sm" style={{ gap: 0 }}>
          <span className="muted">{formatDateBn(t)}</span>
          <h1>আজকের চেম্বার · {chamber.name}</h1>
        </div>
        <Link className="btn btn-primary btn-big" href={`/dashboard/queue?chamber=${chamber.id}`}>সিরিয়াল কিউ খুলুন</Link>
      </div>
      <ChamberTabs chambers={list} current={chamber.id} base="/dashboard" />
      <div className="grid">
        <div className="card"><span className="muted small">আজকের মোট সিরিয়াল</span><div className="big-num">{bn(st.total)}</div><span className="muted small">অনলাইন {bn(online)} · সরাসরি {bn(st.total - online)}</span></div>
        <div className="card"><span className="muted small">দেখা হয়েছে</span><div className="big-num" style={{ color: "var(--teal)" }}>{bn(st.done)}</div><span className="muted small">{st.current ? `এখন চলছে ${bn(st.current.serialNo)} নম্বর` : "এখন কেউ চলছে না"}</span></div>
        <div className="card"><span className="muted small">অনুপস্থিত</span><div className="big-num" style={{ color: "var(--orange)" }}>{bn(st.absent)}</div></div>
        <div className="card"><span className="muted small">আজকের আনুমানিক আয়</span><div className="big-num">৳{bn(income.n)}</div><span className="muted small">সম্পন্ন ভিজিটের ফি অনুযায়ী</span></div>
      </div>
      <div className="row" style={{ alignItems: "flex-start", gap: 16 }}>
        <div className="card stack-sm" style={{ flex: "2 1 420px", minWidth: 0 }}>
          <h2>পরের রোগী</h2>
          {upcoming.length === 0 && <p className="muted">অপেক্ষমাণ কেউ নেই।</p>}
          {upcoming.map((r) => r && (
            <div key={r.id} className="row" style={{ borderTop: "1px solid #eef1ef", paddingTop: 8 }}>
              <span className="badge badge-teal" style={{ fontSize: 16, minWidth: 40, textAlign: "center" }}>{bn(r.serialNo)}</span>
              <span style={{ flex: 1 }}>{r.patientName} <span className="muted small">{patientCode(r.patientNumber)} · {r.type === "FOLLOW_UP" ? "ফলোআপ" : "নতুন"}</span></span>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </div>
        <div className="stack" style={{ flex: "1 1 260px", minWidth: 0 }}>
          <div className="card card-warn stack-sm">
            <strong style={{ color: "var(--orange-ink)" }}>ফলোআপ মিস</strong>
            <span className="big-num">{bn(missed.n)} জন</span>
            <Link href="/dashboard/followups" style={{ color: "var(--orange-ink)", fontWeight: 700 }}>তালিকা দেখুন</Link>
          </div>
          <div className="card stack-sm">
            <strong>এই মাসে এসএমএস</strong>
            <span className="big-num">{bn(sms.n)}টি</span>
            <span className="muted small">বুকিং, রিমাইন্ডার ও ছুটির নোটিশ মিলিয়ে</span>
          </div>
        </div>
      </div>
    </>
  );
}
