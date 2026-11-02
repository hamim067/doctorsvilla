import { and, eq, gte, lte, sql } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { requireDoctor } from "@/lib/auth";
import { addDays, bn, formatDateBn, today } from "@/lib/time";

export const metadata = { title: "রিপোর্ট" };
export const dynamic = "force-dynamic";

const RANGES = [
  { key: "7", label: "৭ দিন", days: 7 },
  { key: "30", label: "৩০ দিন", days: 30 },
  { key: "90", label: "৩ মাস", days: 90 },
];

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

async function periodStats(doctorId: string, from: string, to: string) {
  const { bookings, chambers, followUps, messageLogs } = schema;
  const [[bk], [fu], [sms]] = await Promise.all([
    db.select({
      total: sql<number>`count(*) filter (where ${bookings.status} <> 'CANCELLED')::int`,
      done: sql<number>`count(*) filter (where ${bookings.status} = 'DONE')::int`,
      absent: sql<number>`count(*) filter (where ${bookings.status} = 'ABSENT')::int`,
      online: sql<number>`count(*) filter (where ${bookings.status} <> 'CANCELLED' and ${bookings.source} = 'ONLINE')::int`,
      followUp: sql<number>`count(*) filter (where ${bookings.status} = 'DONE' and ${bookings.type} = 'FOLLOW_UP')::int`,
      cancelled: sql<number>`count(*) filter (where ${bookings.status} = 'CANCELLED')::int`,
      income: sql<number>`coalesce(sum(case when ${bookings.status} = 'DONE' then (case when ${bookings.type} = 'FOLLOW_UP' then ${chambers.feeFollowUp} else ${chambers.feeNew} end) end), 0)::int`,
    }).from(bookings).innerJoin(chambers, eq(chambers.id, bookings.chamberId))
      .where(and(eq(bookings.doctorId, doctorId), gte(bookings.date, from), lte(bookings.date, to))),
    db.select({
      due: sql<number>`count(*) filter (where ${followUps.status} <> 'CANCELLED')::int`,
      back: sql<number>`count(*) filter (where ${followUps.status} = 'BOOKED')::int`,
    }).from(followUps).where(and(eq(followUps.doctorId, doctorId), gte(followUps.dueDate, from), lte(followUps.dueDate, to))),
    db.select({ n: sql<number>`count(*)::int` }).from(messageLogs)
      .where(and(eq(messageLogs.doctorId, doctorId), eq(messageLogs.channel, "sms"), gte(messageLogs.createdAt, new Date(`${from}T00:00:00+06:00`)), lte(messageLogs.createdAt, new Date(`${to}T23:59:59+06:00`)))),
  ]);
  return { ...bk, fuDue: fu.due, fuBack: fu.back, sms: sms.n };
}

function Delta({ now, before }: { now: number; before: number }) {
  if (!before) return null;
  const d = Math.round(((now - before) / before) * 100);
  if (d === 0) return <span className="small muted">আগের সময়ের সমান</span>;
  return <span className="small" style={{ color: d > 0 ? "var(--teal)" : "var(--orange-ink)", fontWeight: 600 }}>{d > 0 ? "▲" : "▼"} {bn(Math.abs(d))}% আগের {""}সময়ের তুলনায়</span>;
}

export default async function Reports({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const s = await requireDoctor();
  const { range = "30" } = await searchParams;
  const r = RANGES.find((x) => x.key === range) ?? RANGES[1];
  const to = today();
  const from = addDays(to, -(r.days - 1));
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(r.days - 1));

  const { bookings, chambers } = schema;
  const [cur, prev, daily, perChamber] = await Promise.all([
    periodStats(s.doctorId, from, to),
    periodStats(s.doctorId, prevFrom, prevTo),
    db.select({ date: bookings.date, done: sql<number>`count(*) filter (where ${bookings.status} = 'DONE')::int`, total: sql<number>`count(*) filter (where ${bookings.status} <> 'CANCELLED')::int` })
      .from(bookings).where(and(eq(bookings.doctorId, s.doctorId), gte(bookings.date, from), lte(bookings.date, to))).groupBy(bookings.date),
    db.select({
      name: chambers.name, city: chambers.city, active: chambers.active,
      done: sql<number>`count(${bookings.id}) filter (where ${bookings.status} = 'DONE')::int`,
      online: sql<number>`count(${bookings.id}) filter (where ${bookings.status} <> 'CANCELLED' and ${bookings.source} = 'ONLINE')::int`,
      total: sql<number>`count(${bookings.id}) filter (where ${bookings.status} <> 'CANCELLED')::int`,
      absent: sql<number>`count(${bookings.id}) filter (where ${bookings.status} = 'ABSENT')::int`,
      income: sql<number>`coalesce(sum(case when ${bookings.status} = 'DONE' then (case when ${bookings.type} = 'FOLLOW_UP' then ${chambers.feeFollowUp} else ${chambers.feeNew} end) end), 0)::int`,
    }).from(chambers)
      .leftJoin(bookings, and(eq(bookings.chamberId, chambers.id), gte(bookings.date, from), lte(bookings.date, to)))
      .where(eq(chambers.doctorId, s.doctorId)).groupBy(chambers.id),
  ]);

  // দৈনিক চার্ট — প্রতিটি দিন, রোগী না থাকলেও ০
  const byDate = new Map(daily.map((d) => [d.date, d]));
  const days = Array.from({ length: r.days }, (_, i) => {
    const date = addDays(from, i);
    return { date, done: byDate.get(date)?.done ?? 0, total: byDate.get(date)?.total ?? 0 };
  });
  const max = Math.max(1, ...days.map((d) => d.total));
  const W = 1000, H = 220, pad = 28, bw = (W - pad) / days.length;
  const busiest = days.reduce((a, d) => (d.done > a.done ? d : a), days[0]);
  const labelEvery = r.days <= 7 ? 1 : r.days <= 30 ? 5 : 15;

  const kpis = [
    { l: "রোগী দেখা হয়েছে", v: bn(cur.done), d: <Delta now={cur.done} before={prev.done} /> },
    { l: "আনুমানিক আয়", v: `৳${bn(cur.income.toLocaleString("en-IN"))}`, d: <Delta now={cur.income} before={prev.income} /> },
    { l: "অনলাইন বুকিং", v: `${bn(pct(cur.online, cur.total))}%`, d: <span className="small muted">{bn(cur.online)} / {bn(cur.total)} সিরিয়াল</span> },
    { l: "ফলোআপে ফিরেছেন", v: `${bn(pct(cur.fuBack, cur.fuDue))}%`, d: <span className="small muted">{bn(cur.fuBack)} / {bn(cur.fuDue)} জন</span> },
    { l: "অনুপস্থিত", v: `${bn(pct(cur.absent, cur.total))}%`, d: <span className="small muted">{bn(cur.absent)} জন · বাতিল {bn(cur.cancelled)}</span> },
    { l: "এসএমএস পাঠানো", v: bn(cur.sms), d: <span className="small muted">বুকিং, রিমাইন্ডার ও নোটিশ</span> },
  ];

  return (
    <>
      <div className="row between">
        <div className="stack-sm" style={{ gap: 2 }}>
          <h1>রিপোর্ট</h1>
          <span className="muted">{formatDateBn(from, false)} – {formatDateBn(to, false)} · আগের {r.label}ের সাথে তুলনা</span>
        </div>
        <nav className="row" aria-label="সময়">
          {RANGES.map((x) => <Link key={x.key} href={`?range=${x.key}`} className={x.key === r.key ? "btn btn-primary" : "btn"} aria-current={x.key === r.key ? "page" : undefined}>{x.label}</Link>)}
        </nav>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {kpis.map((k) => (
          <div key={k.l} className="card stack-sm" style={{ gap: 2 }}>
            <span className="muted small">{k.l}</span>
            <span className="big-num">{k.v}</span>
            {k.d}
          </div>
        ))}
      </div>

      <div className="card stack">
        <div className="row between">
          <h2>প্রতিদিন রোগী</h2>
          {busiest.done > 0 && <span className="small muted">সবচেয়ে ব্যস্ত দিন: {formatDateBn(busiest.date)} — {bn(busiest.done)} জন</span>}
        </div>
        <svg viewBox={`0 0 ${W} ${H + 26}`} role="img" aria-label={`গত ${r.label}ে প্রতিদিন দেখা রোগীর সংখ্যা`} style={{ width: "100%", height: "auto" }}>
          {[0.5, 1].map((f) => (
            <g key={f}>
              <line x1={pad} x2={W} y1={H - (H - 10) * f} y2={H - (H - 10) * f} stroke="#E6EBE8" />
              <text x={pad - 6} y={H - (H - 10) * f + 4} textAnchor="end" fontSize="12" fill="#55635F">{bn(Math.round(max * f))}</text>
            </g>
          ))}
          <line x1={pad} x2={W} y1={H} y2={H} stroke="#C9D3CF" />
          {days.map((d, i) => {
            const x = pad + i * bw + bw * 0.15, w = Math.max(2, bw * 0.7);
            const hTot = ((H - 10) * d.total) / max, hDone = ((H - 10) * d.done) / max;
            return (
              <g key={d.date}>
                <title>{`${formatDateBn(d.date)}: ${d.done} জন দেখা, মোট সিরিয়াল ${d.total}`}</title>
                {d.total > d.done && <rect x={x} y={H - hTot} width={w} height={hTot - hDone} fill="#CFE6E0" className="rp-rest" rx="2" />}
                {d.done > 0 && <rect x={x} y={H - hDone} width={w} height={hDone} fill="#0B6E5F" rx="2" />}
                {i % labelEvery === 0 && <text x={x + w / 2} y={H + 18} textAnchor="middle" fontSize="12" fill="#55635F">{formatDateBn(d.date, false).split(" ")[0]}</text>}
              </g>
            );
          })}
        </svg>
        <div className="row small muted">
          <span className="row" style={{ gap: 6 }}><span style={{ width: 12, height: 12, background: "#0B6E5F", borderRadius: 3 }} />দেখা হয়েছে</span>
          <span className="row" style={{ gap: 6 }}><span style={{ width: 12, height: 12, background: "#CFE6E0", borderRadius: 3 }} />সিরিয়াল ছিল কিন্তু দেখা হয়নি (অপেক্ষমাণ/অনুপস্থিত)</span>
        </div>
      </div>

      <div className="row" style={{ alignItems: "stretch", gap: 16 }}>
        <div className="card stack-sm" style={{ flex: "1 1 280px" }}>
          <h2>নতুন বনাম ফলোআপ</h2>
          <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: "var(--track)" }} role="img" aria-label={`নতুন ${cur.done - cur.followUp}, ফলোআপ ${cur.followUp}`}>
            <span style={{ width: `${pct(cur.done - cur.followUp, cur.done)}%`, background: "#0B6E5F" }} />
            <span style={{ width: `${pct(cur.followUp, cur.done)}%`, background: "#C2551A" }} />
          </div>
          <span className="small"><b style={{ color: "var(--teal-ink)" }}>নতুন {bn(cur.done - cur.followUp)} জন</b> · <b style={{ color: "#C2551A" }}>ফলোআপ {bn(cur.followUp)} জন</b></span>
          <span className="small muted">অটোমেটিক রিমাইন্ডারে যারা ফিরে এসেছেন, তারা ফলোআপের মধ্যে।</span>
        </div>
        <div className="card stack-sm" style={{ flex: "1 1 280px" }}>
          <h2>সিরিয়াল কোথা থেকে</h2>
          <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: "var(--track)" }} role="img" aria-label={`অনলাইন ${cur.online}, সরাসরি ${cur.total - cur.online}`}>
            <span style={{ width: `${pct(cur.online, cur.total)}%`, background: "#0B6E5F" }} />
            <span style={{ width: `${pct(cur.total - cur.online, cur.total)}%`, background: "#9AAAA5" }} />
          </div>
          <span className="small"><b style={{ color: "var(--teal-ink)" }}>অনলাইন {bn(cur.online)}</b> · <b style={{ color: "var(--muted)" }}>সরাসরি এসে {bn(cur.total - cur.online)}</b></span>
          <span className="small muted">QR পোস্টার আর প্রোফাইল লিংক শেয়ার করলে অনলাইন বাড়ে — <Link href="/dashboard/share">শেয়ার পেজ</Link></span>
        </div>
      </div>

      <h2>চেম্বার অনুযায়ী</h2>
      <div className="table-wrap"><table>
        <thead><tr><th>চেম্বার</th><th>দেখা হয়েছে</th><th>মোট সিরিয়াল</th><th>অনলাইন</th><th>অনুপস্থিত</th><th>আনুমানিক আয়</th></tr></thead>
        <tbody>
          {perChamber.map((c) => (
            <tr key={c.name + c.city}>
              <td><strong>{c.name}</strong> <span className="muted small">{c.city}{c.active ? "" : " · বন্ধ"}</span></td>
              <td>{bn(c.done)}</td><td>{bn(c.total)}</td><td>{bn(pct(c.online, c.total))}%</td><td>{bn(c.absent)}</td>
              <td>৳{bn(c.income.toLocaleString("en-IN"))}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <p className="muted small">আয় হিসাব করা হয়েছে সম্পন্ন ভিজিট × চেম্বারের ফি দিয়ে — চেম্বারে আসল আদায়ের সাথে কিছুটা পার্থক্য থাকতে পারে।</p>
    </>
  );
}
