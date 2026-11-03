import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icons";
import { StatusBadge } from "@/components/StatusBadge";
import { requireDoctor } from "@/lib/auth";
import { patientCode } from "@/lib/booking";
import { bn, formatDateBn, MONTHS_BN, today, WEEKDAYS_SHORT_BN } from "@/lib/time";
import "../../dash.css";
import "./calendar.css";

export const metadata = { title: "ক্যালেন্ডার রিপোর্ট" };
export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");
const ymOf = (d: string) => d.slice(0, 7);
function shiftMonth(ym: string, by: number) {
  const [y, m] = ym.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`;
}
const money = (n: number) => `৳${bn(n.toLocaleString("en-IN"))}`;

/** ক্যালেন্ডার অনুযায়ী রিপোর্ট — মাসের প্রতিটা দিনে কতজন দেখা হয়েছে, কত আয়; দিনে ক্লিক করলে সেদিনের তালিকা */
export default async function CalendarReport({ searchParams }: { searchParams: Promise<{ month?: string; day?: string; chamber?: string }> }) {
  const s = await requireDoctor();
  const sp = await searchParams;
  const t = today();
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? ymOf(sp.day) : ymOf(t);
  const [y, m] = month.split("-").map(Number);
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const from = `${month}-01`;
  const to = `${month}-${pad(daysIn)}`;
  const day = sp.day && sp.day.startsWith(month) ? sp.day : null;

  const { bookings, chambers, patients } = schema;
  const chamberList = await db.select({ id: chambers.id, name: chambers.name }).from(chambers).where(eq(chambers.doctorId, s.doctorId)).orderBy(asc(chambers.createdAt));
  const chamberId = chamberList.find((c) => c.id === sp.chamber)?.id ?? null;
  const scope = and(eq(bookings.doctorId, s.doctorId), chamberId ? eq(bookings.chamberId, chamberId) : undefined);
  const fee = sql`(case when ${bookings.type} = 'FOLLOW_UP' then ${chambers.feeFollowUp} else ${chambers.feeNew} end)`;

  const [rows, dayRows] = await Promise.all([
    db.select({
      date: bookings.date,
      total: sql<number>`count(*) filter (where ${bookings.status} <> 'CANCELLED')::int`,
      done: sql<number>`count(*) filter (where ${bookings.status} = 'DONE')::int`,
      absent: sql<number>`count(*) filter (where ${bookings.status} = 'ABSENT')::int`,
      fu: sql<number>`count(*) filter (where ${bookings.status} = 'DONE' and ${bookings.type} = 'FOLLOW_UP')::int`,
      online: sql<number>`count(*) filter (where ${bookings.status} <> 'CANCELLED' and ${bookings.source} = 'ONLINE')::int`,
      income: sql<number>`coalesce(sum(case when ${bookings.status} = 'DONE' then ${fee} end), 0)::int`,
    }).from(bookings).innerJoin(chambers, eq(chambers.id, bookings.chamberId))
      .where(and(scope, gte(bookings.date, from), lte(bookings.date, to))).groupBy(bookings.date),
    day
      ? db.select({
          id: bookings.id, serialNo: bookings.serialNo, status: bookings.status, type: bookings.type, source: bookings.source, code: bookings.code,
          name: patients.name, number: patients.number, patientId: patients.id, chamber: chambers.name, fee: sql<number>`${fee}::int`,
        }).from(bookings).innerJoin(chambers, eq(chambers.id, bookings.chamberId)).innerJoin(patients, eq(patients.id, bookings.patientId))
          .where(and(scope, eq(bookings.date, day))).orderBy(asc(chambers.name), asc(bookings.serialNo))
      : Promise.resolve([]),
  ]);
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const sum = rows.reduce((a, r) => ({ total: a.total + r.total, done: a.done + r.done, income: a.income + r.income, fu: a.fu + r.fu, absent: a.absent + r.absent, online: a.online + r.online }), { total: 0, done: 0, income: 0, fu: 0, absent: 0, online: 0 });
  const max = Math.max(1, ...rows.map((r) => r.done));
  const busiest = rows.length ? rows.reduce((a, r) => (r.done > a.done ? r : a)) : null;
  const workDays = rows.filter((r) => r.done > 0).length;

  // শনিবার থেকে সপ্তাহ শুরু (বাংলাদেশে প্রচলিত)
  const firstWd = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const lead = (firstWd + 1) % 7;
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => `${month}-${pad(i + 1)}`)];
  while (cells.length % 7) cells.push(null);
  const weekHead = [6, 0, 1, 2, 3, 4, 5].map((w) => WEEKDAYS_SHORT_BN[w]);
  const q = (o: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ month, chamber: chamberId, ...o })) if (v) p.set(k, v);
    return `?${p}`;
  };
  const d = day ? byDate.get(day) : null;

  return (
    <div className="db cal">
      <div className="db-head">
        <div className="col" style={{ gap: 4 }}>
          <Link href="/dashboard/reports" className="small muted">← রিপোর্ট</Link>
          <h1>ক্যালেন্ডার রিপোর্ট</h1>
        </div>
        <div className="row cal-nav">
          <Link className="btn" href={q({ month: shiftMonth(month, -1), day: null })} aria-label="আগের মাস"><Icon name="chevron" size={18} /></Link>
          <b className="cal-month">{MONTHS_BN[m - 1]} {bn(y)}</b>
          <Link className="btn" href={q({ month: shiftMonth(month, 1), day: null })} aria-label="পরের মাস"><Icon name="chevron" size={18} /></Link>
          {month !== ymOf(t) && <Link className="btn" href={q({ month: ymOf(t), day: null })}>এই মাস</Link>}
        </div>
      </div>

      {chamberList.length > 1 && (
        <nav className="cal-tabs" aria-label="চেম্বার">
          <Link href={q({ chamber: null, day })} className={!chamberId ? "on" : ""}>সব চেম্বার</Link>
          {chamberList.map((c) => <Link key={c.id} href={q({ chamber: c.id, day })} className={chamberId === c.id ? "on" : ""}>{c.name}</Link>)}
        </nav>
      )}

      <div className="db-kpis">
        <div className="kpi"><span className="kpi-label">রোগী দেখা হয়েছে</span><span className="kpi-value">{bn(sum.done)}</span><span className="kpi-sub">মোট সিরিয়াল {bn(sum.total)} · ফলোআপ {bn(sum.fu)}</span></div>
        <div className="kpi"><span className="kpi-label">আনুমানিক আয়</span><span className="kpi-value">{money(sum.income)}</span><span className="kpi-sub">সম্পন্ন ভিজিট × চেম্বারের ফি</span></div>
        <div className="kpi"><span className="kpi-label">চেম্বারের দিন</span><span className="kpi-value">{bn(workDays)}</span><span className="kpi-sub">দিনে গড় {bn(workDays ? Math.round(sum.done / workDays) : 0)} জন</span></div>
        <div className="kpi"><span className="kpi-label">সবচেয়ে ব্যস্ত দিন</span><span className="kpi-value small-v">{busiest && busiest.done ? formatDateBn(busiest.date, false) : "—"}</span><span className="kpi-sub">{busiest && busiest.done ? `${bn(busiest.done)} জন` : "এখনো ডেটা নেই"} · অনুপস্থিত {bn(sum.absent)}</span></div>
      </div>

      <div className={`cal-grid-wrap${day ? " has-day" : ""}`}>
        <section className="card cal-card" aria-label="মাসের ক্যালেন্ডার">
          <div className="cal-grid">
            {weekHead.map((w, i) => <span key={w} className={`cal-wd${i === 6 ? " fri" : ""}`}>{w}</span>)}
            {cells.map((c, i) => {
              if (!c) return <span key={`e${i}`} className="cal-cell empty" />;
              const r = byDate.get(c);
              const lvl = r && r.done ? Math.min(4, Math.ceil((r.done / max) * 4)) : 0;
              const cls = ["cal-cell", `l${lvl}`, c === t ? "today" : "", c === day ? "sel" : "", c > t ? "future" : ""].join(" ");
              return (
                <Link key={c} href={q({ day: c === day ? null : c })} className={cls} aria-current={c === day ? "date" : undefined}
                  aria-label={`${formatDateBn(c)}: ${r ? `${r.done} জন দেখা, আয় ${r.income} টাকা` : "কোনো সিরিয়াল নেই"}`}>
                  <span className="cal-d">{bn(Number(c.slice(8)))}</span>
                  {r && r.total > 0 && (
                    <>
                      <b className="cal-n">{bn(r.done)}<small> জন</small></b>
                      <span className="cal-i">{money(r.income)}</span>
                      {r.done < r.total && <span className="cal-dot" title="বাকি/অনুপস্থিত আছে" />}
                    </>
                  )}
                </Link>
              );
            })}
          </div>
          <div className="cal-legend">
            <span>কম</span>{[1, 2, 3, 4].map((l) => <i key={l} className={`l${l}`} />)}<span>বেশি রোগী</span>
            <span className="cal-legend-r"><span className="cal-dot" /> সিরিয়াল ছিল, কিন্তু সবাই আসেননি</span>
          </div>
        </section>

        {day && (
          <section className="card cal-day" aria-label="দিনের বিস্তারিত">
            <div className="row-sb">
              <div className="col" style={{ gap: 2 }}>
                <h2>{formatDateBn(day)}</h2>
                <span className="muted small">{d ? `${bn(d.done)} জন দেখা · ${bn(d.total)} সিরিয়াল · অনলাইন ${bn(d.online)}` : "এই দিনে কোনো সিরিয়াল ছিল না"}</span>
              </div>
              <Link href={q({ day: null })} className="btn btn-sm" aria-label="বন্ধ"><Icon name="x" size={16} /></Link>
            </div>
            {d && (
              <div className="cal-day-k">
                <span><b>{money(d.income)}</b>আয়</span>
                <span><b>{bn(d.done - d.fu)}</b>নতুন</span>
                <span><b>{bn(d.fu)}</b>ফলোআপ</span>
                <span><b>{bn(d.absent)}</b>অনুপস্থিত</span>
              </div>
            )}
            <ul className="cal-list">
              {dayRows.map((b) => (
                <li key={b.id}>
                  <span className="cal-sn">{bn(b.serialNo)}</span>
                  <span className="col grow" style={{ minWidth: 0 }}>
                    <Link href={`/dashboard/patients/${b.patientId}`} className="cal-pn">{b.name}</Link>
                    <span className="muted xs">{patientCode(b.number)} · {b.type === "FOLLOW_UP" ? "ফলোআপ" : "নতুন"} · {b.source === "ONLINE" ? "অনলাইন" : "সরাসরি"}{chamberList.length > 1 ? ` · ${b.chamber}` : ""}</span>
                  </span>
                  <span className="col right" style={{ gap: 2 }}>
                    <StatusBadge status={b.status} />
                    {b.status === "DONE" && <span className="xs muted">৳{bn(b.fee)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
