import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ChamberTabs } from "@/components/ChamberTabs";
import { AreaChart, ColumnChart, Sparkline, SplitBar } from "@/components/charts";
import { Icon } from "@/components/Icons";
import { StatusBadge } from "@/components/StatusBadge";
import { requireStaff } from "@/lib/auth";
import { patientCode } from "@/lib/booking";
import { doctorChambers, pickChamber } from "@/lib/chambers";
import { liveState } from "@/lib/queue";
import { addDays, bn, clockDhaka, formatDateBn, formatTimeBn, today, WEEKDAYS_SHORT_BN, weekday } from "@/lib/time";
import "./dash.css";

export const metadata = { title: "ড্যাশবোর্ড" };
export const dynamic = "force-dynamic";

const money = (n: number) => `৳${bn(n.toLocaleString("en-IN"))}`;
const pctOf = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function greeting(hhmm: string) {
  const h = Number(hhmm.slice(0, 2));
  return h < 12 ? "শুভ সকাল" : h < 16 ? "শুভ দুপুর" : h < 18 ? "শুভ বিকাল" : "শুভ সন্ধ্যা";
}

function Delta({ now, before, suffix = "গত সপ্তাহের তুলনায়" }: { now: number; before: number; suffix?: string }) {
  if (!before && !now) return <span className="kpi-sub">এখনো ডেটা নেই</span>;
  if (!before) return <span className="kpi-sub">তুলনার জন্য আগের ডেটা নেই</span>;
  const d = Math.round(((now - before) / before) * 100);
  return (
    <span className={`kpi-delta ${d > 0 ? "up" : d < 0 ? "down" : ""}`}>
      {d > 0 ? "▲" : d < 0 ? "▼" : "•"} {bn(Math.abs(d))}% <span>{suffix}</span>
    </span>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ chamber?: string; denied?: string }> }) {
  const s = await requireStaff();
  const sp = await searchParams;
  const list = await doctorChambers(s.doctorId);
  const chamber = pickChamber(list, sp.chamber);
  const [doc] = await db.select({ name: schema.doctors.name }).from(schema.doctors).where(eq(schema.doctors.id, s.doctorId)).limit(1);
  const now = clockDhaka(new Date());

  if (!chamber) {
    return (
      <div className="db-empty card stack">
        <h1>{greeting(now)}, {doc?.name}!</h1>
        <p>শুরু করতে আপনার প্রথম চেম্বার যোগ করুন — তারপরই রোগীরা অনলাইনে সিরিয়াল নিতে পারবেন আর এখানে চার্টগুলো ভরে উঠবে।</p>
        <div><Link className="btn btn-primary btn-big" href="/dashboard/chambers">চেম্বার যোগ করুন</Link></div>
      </div>
    );
  }

  const t = today();
  const d14 = addDays(t, -13), d7 = addDays(t, -6), p7a = addDays(t, -13), p7b = addDays(t, -7);
  const d30 = addDays(t, -29), next7 = addDays(t, 7);
  const monthStart = `${t.slice(0, 7)}-01`; // এসএমএস গোনা হয় চলতি মাসে
  const { bookings, chambers, followUps, messageLogs } = schema;
  const fee = sql`case when ${bookings.feeWaived} then 0 when ${bookings.type} = 'FOLLOW_UP' then ${chambers.feeFollowUp} else ${chambers.feeNew} end`;
  const mine = eq(bookings.doctorId, s.doctorId);

  const [st, daily, [month], hourly, upcoming, [mix], [fu], [missed], [sms]] = await Promise.all([
    liveState(chamber.id, t),
    db.select({
      date: bookings.date,
      done: sql<number>`count(*) filter (where ${bookings.status} = 'DONE')::int`,
      income: sql<number>`coalesce(sum(${fee}) filter (where ${bookings.status} = 'DONE'), 0)::int`,
    }).from(bookings).innerJoin(chambers, eq(chambers.id, bookings.chamberId))
      .where(and(mine, gte(bookings.date, d14), lte(bookings.date, t))).groupBy(bookings.date),
    db.select({
      cur: sql<number>`coalesce(sum(${fee}) filter (where ${bookings.status} = 'DONE' and ${bookings.date} >= ${d30}), 0)::int`,
      prev: sql<number>`coalesce(sum(${fee}) filter (where ${bookings.status} = 'DONE' and ${bookings.date} < ${d30}), 0)::int`,
    }).from(bookings).innerJoin(chambers, eq(chambers.id, bookings.chamberId)).where(and(mine, gte(bookings.date, addDays(t, -59)), lte(bookings.date, t))),
    db.select({
      hour: sql<number>`extract(hour from coalesce(${bookings.completedAt}, ${bookings.calledAt}) at time zone 'Asia/Dhaka')::int`,
      n: sql<number>`count(*)::int`,
    }).from(bookings)
      .where(and(mine, gte(bookings.date, d30), eq(bookings.status, "DONE"), sql`coalesce(${bookings.completedAt}, ${bookings.calledAt}) is not null`))
      .groupBy(sql`1`),
    db.select({ date: bookings.date, n: sql<number>`count(*)::int` }).from(bookings)
      .where(and(mine, gte(bookings.date, addDays(t, 1)), lte(bookings.date, next7), inArray(bookings.status, ["WAITING"]))).groupBy(bookings.date),
    db.select({
      fresh: sql<number>`count(*) filter (where ${bookings.status} = 'DONE' and ${bookings.type} = 'NEW')::int`,
      followUp: sql<number>`count(*) filter (where ${bookings.status} = 'DONE' and ${bookings.type} = 'FOLLOW_UP')::int`,
      online: sql<number>`count(*) filter (where ${bookings.status} <> 'CANCELLED' and ${bookings.source} = 'ONLINE')::int`,
      walkIn: sql<number>`count(*) filter (where ${bookings.status} <> 'CANCELLED' and ${bookings.source} = 'WALK_IN')::int`,
    }).from(bookings).where(and(mine, gte(bookings.date, d30), lte(bookings.date, t))),
    db.select({
      due: sql<number>`count(*) filter (where ${followUps.status} <> 'CANCELLED')::int`,
      back: sql<number>`count(*) filter (where ${followUps.status} = 'BOOKED')::int`,
    }).from(followUps).where(and(eq(followUps.doctorId, s.doctorId), gte(followUps.dueDate, d30), lte(followUps.dueDate, t))),
    db.select({ n: sql<number>`count(*)::int` }).from(followUps).where(and(eq(followUps.doctorId, s.doctorId), eq(followUps.status, "MISSED"))),
    db.select({ n: sql<number>`count(*)::int` }).from(messageLogs)
      .where(and(eq(messageLogs.doctorId, s.doctorId), eq(messageLogs.channel, "sms"), gte(messageLogs.createdAt, new Date(`${monthStart}T00:00:00+06:00`)))),
  ]);
  const live = st!;

  // ---- সিরিজ তৈরি ----
  const byDate = new Map(daily.map((d) => [d.date, d]));
  const days14 = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(d14, i);
    return { date, done: byDate.get(date)?.done ?? 0, income: byDate.get(date)?.income ?? 0 };
  });
  const sum = (a: typeof days14, k: "done" | "income") => a.reduce((x, d) => x + d[k], 0);
  const week = days14.filter((d) => d.date >= d7);
  const prevWeek = days14.filter((d) => d.date >= p7a && d.date <= p7b);
  const seenWeek = sum(week, "done"), seenPrev = sum(prevWeek, "done");
  const incomeWeek = sum(week, "income"), incomePrev = sum(prevWeek, "income");

  const areaPts = days14.map((d) => ({
    label: d.date === t ? "আজ" : bn(Number(d.date.slice(8))),
    value: d.done,
    tip: formatDateBn(d.date),
  }));

  const hourMap = new Map(hourly.map((h) => [h.hour, h.n]));
  const hrs = hourly.length ? hourly.map((h) => h.hour) : [17, 18, 19, 20];
  const hFrom = Math.min(...hrs), hTo = Math.max(...hrs);
  const hourPts = Array.from({ length: hTo - hFrom + 1 }, (_, i) => {
    const h = hFrom + i;
    const lab = formatTimeBn(`${String(h).padStart(2, "0")}:00`);
    return { label: `${lab.split(" ")[1].replace(":০০", "")}টা`, value: hourMap.get(h) ?? 0, tip: `${lab} – ${formatTimeBn(`${String(h + 1).padStart(2, "0")}:00`)}` };
  });
  const peakHour = hourPts.reduce((a, p, i) => (p.value > hourPts[a].value ? i : a), 0);

  const upMap = new Map(upcoming.map((u) => [u.date, u.n]));
  const nextPts = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(t, i + 1);
    return { label: i === 0 ? "কাল" : WEEKDAYS_SHORT_BN[weekday(date)], value: upMap.get(date) ?? 0, tip: formatDateBn(date) };
  });
  const nextTotal = nextPts.reduce((a, p) => a + p.value, 0);

  // ---- আজকের লাইভ ----
  const done = live.done, total = live.total;
  const left = live.waiting.length + (live.current ? 1 : 0);
  const [eh, em] = now.split(":").map(Number);
  const endMin = eh * 60 + em + left * live.avg;
  const finish = left ? formatTimeBn(`${String(Math.floor(endMin / 60) % 24).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`) : null;
  const queue = [live.current, ...live.waiting].filter(Boolean).slice(0, 5);
  const online = live.rows.filter((r) => r.source === "ONLINE").length;

  const kpis = [
    { label: "এই সপ্তাহে রোগী", value: bn(seenWeek), spark: week.map((d) => d.done), delta: <Delta now={seenWeek} before={seenPrev} />, icon: "family" as const },
    { label: "এই সপ্তাহের আয়", value: money(incomeWeek), spark: week.map((d) => d.income), delta: <Delta now={incomeWeek} before={incomePrev} />, icon: "pulse" as const },
    { label: "গত ৩০ দিনের আয়", value: money(month.cur), spark: days14.map((d) => d.income), delta: <Delta now={month.cur} before={month.prev} suffix="আগের ৩০ দিনের তুলনায়" />, icon: "shield" as const },
    { label: "ফলোআপে ফিরেছেন", value: `${bn(pctOf(fu.back, fu.due))}%`, spark: null, delta: <span className="kpi-sub">গত ৩০ দিনে {bn(fu.back)} / {bn(fu.due)} জন</span>, icon: "bell" as const },
  ];

  return (
    <div className="db">
      <AutoRefresh seconds={30} />
      {sp.denied && <p className="alert alert-error">এই পেজ শুধু ডাক্তার নিজে দেখতে পারবেন।</p>}

      <header className="db-head">
        <div className="col" style={{ gap: 2 }}>
          <span className="muted">{formatDateBn(t)}</span>
          <h1>{greeting(now)}, {doc?.name?.replace(/^ডা\.\s*/, "ডা. ")}</h1>
        </div>
        <div className="row">
          <Link className="btn" href="/dashboard/reports">পুরো রিপোর্ট</Link>
          <Link className="btn btn-primary" href={`/dashboard/queue?chamber=${chamber.id}`}>সিরিয়াল কিউ খুলুন →</Link>
        </div>
      </header>
      <ChamberTabs chambers={list} current={chamber.id} base="/dashboard" />

      {/* ---- আজকের লাইভ ---- */}
      <section className="db-live">
        <div className="db-live-now">
          <span className="db-live-tag"><span className="dot" />{live.current ? "লাইভ" : total ? "বিরতি" : "আজ এখনো শুরু হয়নি"} · {chamber.name}</span>
          <div className="db-live-main">
            <div className="col"><span className="soft small">এখন চলছে</span><span className="db-live-num">{live.current ? bn(live.current.serialNo) : "—"}</span></div>
            <div className="db-live-who">
              <b>{live.current?.patientName ?? (live.waiting[0] ? `পরের জন: ${live.waiting[0].patientName}` : "অপেক্ষমাণ কেউ নেই")}</b>
              <span className="soft small">{live.current ? `${live.current.type === "FOLLOW_UP" ? "ফলোআপ" : "নতুন"} · ${patientCode(live.current.patientNumber)}` : ""}</span>
            </div>
          </div>
          <div className="db-prog" role="img" aria-label={`আজ ${total} জনের মধ্যে ${done} জন দেখা হয়েছে`}>
            <span style={{ width: `${pctOf(done, total)}%` }} />
          </div>
          <div className="db-live-stats">
            <span><b>{bn(done)}</b>/{bn(total)} দেখা হয়েছে</span>
            <span><b>{bn(left)}</b> জন বাকি</span>
            <span>গড় <b>{bn(live.avg)}</b> মিনিট/রোগী</span>
            {finish && <span>শেষ হবে আনুমানিক <b>{finish}</b></span>}
          </div>
        </div>
        <div className="db-live-side">
          <span className="soft small" style={{ fontWeight: 600 }}>পরের রোগী</span>
          {queue.length === 0 && <span className="soft small">কিউ ফাঁকা</span>}
          {queue.map((r) => r && (
            <div key={r.id} className="db-q">
              <span className={`db-q-n ${r.status === "IN_PROGRESS" ? "on" : ""}`}>{bn(r.serialNo)}</span>
              <span className="col grow" style={{ gap: 0 }}><b>{r.patientName}</b><span className="soft xs">{r.type === "FOLLOW_UP" ? "ফলোআপ" : "নতুন"} · {r.source === "ONLINE" ? "অনলাইন" : "সরাসরি"}</span></span>
            </div>
          ))}
          <span className="soft xs" style={{ marginTop: "auto" }}>আজ অনলাইনে {bn(online)} · সরাসরি {bn(total - online)} · অনুপস্থিত {bn(live.absent)}</span>
        </div>
      </section>

      {/* ---- KPI ---- */}
      <section className="db-kpis">
        {kpis.map((k, i) => (
          <div key={k.label} className="kpi">
            <div className="kpi-top"><span className="kpi-label">{k.label}</span><span className={`kpi-ic t${i + 1}`}><Icon name={k.icon} size={18} /></span></div>
            <div className="kpi-mid">
              <span className="kpi-value">{k.value}</span>
              {k.spark && <span className="kpi-spark"><Sparkline values={k.spark} label={`${k.label} — প্রবণতা`} /></span>}
            </div>
            {k.delta}
          </div>
        ))}
      </section>

      {/* ---- চার্ট ---- */}
      <section className="db-grid">
        <div className="card db-chart wide">
          <div className="db-chart-head"><div className="col"><h2>রোগী দেখা হয়েছে — গত ১৪ দিন</h2><span className="small muted">সব চেম্বার মিলিয়ে · চার্টে আঙুল/মাউস রাখুন</span></div>
            <span className="db-big">{bn(sum(days14, "done"))}<small> জন</small></span></div>
          <AreaChart points={areaPts} caption="গত ১৪ দিনে প্রতিদিন দেখা রোগী" height={240} />
        </div>
        <div className="card db-chart">
          <div className="col"><h2>কোন সময় ভিড় বেশি</h2><span className="small muted">গত ৩০ দিন · ঘণ্টা অনুযায়ী দেখা রোগী</span></div>
          <ColumnChart points={hourPts} caption="ঘণ্টা অনুযায়ী দেখা রোগী" highlight={peakHour} width={380} height={220} empty="রোগী দেখা শুরু হলে এখানে দেখাবে কোন সময় ভিড় বেশি" />
          {hourly.length > 0 && <span className="small">সবচেয়ে ব্যস্ত: <b>{hourPts[peakHour].tip}</b> — এই সময় অ্যাসিস্ট্যান্ট প্রস্তুত রাখুন</span>}
        </div>
      </section>

      <section className="db-grid three">
        <div className="card db-chart">
          <div className="db-chart-head"><div className="col"><h2>আগামী ৭ দিনের বুকিং</h2><span className="small muted">এখন পর্যন্ত নেওয়া সিরিয়াল</span></div><span className="db-big">{bn(nextTotal)}</span></div>
          <ColumnChart points={nextPts} caption="আগামী ৭ দিনে বুক করা সিরিয়াল" width={440} height={190} unit="টি সিরিয়াল" empty="এখনো সামনের কোনো বুকিং নেই — QR পোস্টার আর লিংক শেয়ার করলে বাড়বে" />
        </div>
        <div className="card db-chart">
          <div className="col"><h2>রোগীর ধরন</h2><span className="small muted">গত ৩০ দিনে দেখা রোগী</span></div>
          <SplitBar a={mix.fresh} b={mix.followUp} aLabel="নতুন" bLabel="ফলোআপ" />
          <div className="col" style={{ marginTop: 18, gap: 4 }}><h2>সিরিয়াল কোথা থেকে</h2><span className="small muted">গত ৩০ দিন</span></div>
          <SplitBar a={mix.online} b={mix.walkIn} aLabel="অনলাইন" bLabel="সরাসরি এসে" />
        </div>
        <div className="db-side-stack">
          <Link href="/dashboard/followups" className="card db-alert">
            <span className="kpi-ic warn"><Icon name="bell" size={18} /></span>
            <span className="col grow" style={{ gap: 0 }}><span className="kpi-label">ফলোআপ মিস</span><span className="kpi-value">{bn(missed.n)} জন</span><span className="small muted">ফোন করে মনে করিয়ে দিন →</span></span>
          </Link>
          <div className="card db-alert">
            <span className="kpi-ic"><Icon name="check" size={18} /></span>
            <span className="col grow" style={{ gap: 0 }}><span className="kpi-label">এই মাসে এসএমএস</span><span className="kpi-value">{bn(sms.n)}টি</span><span className="small muted">বুকিং, রিমাইন্ডার ও নোটিশ</span></span>
          </div>
          <Link href="/dashboard/share" className="card db-alert db-cta">
            <span className="col grow" style={{ gap: 2 }}><b>অনলাইন বুকিং বাড়ান</b><span className="small">চেম্বারে QR পোস্টার লাগান, প্রোফাইল লিংক শেয়ার করুন →</span></span>
          </Link>
        </div>
      </section>

      {/* ---- আজকের সব সিরিয়াল ---- */}
      <section className="card">
        <div className="row-sb" style={{ marginBottom: 8 }}><h2>আজকের সিরিয়াল</h2><Link href={`/dashboard/queue?chamber=${chamber.id}`} className="small">সব দেখুন →</Link></div>
        {live.rows.length === 0 && <p className="muted">আজ এখনো কোনো সিরিয়াল নেই।</p>}
        <div className="db-today">
          {live.rows.slice(0, 12).map((r) => (
            <Link key={r.id} href={`/dashboard/patients/${r.patientId}`} className={`db-chip ${r.status.toLowerCase()}`}>
              <b>{bn(r.serialNo)}</b><span className="nm">{r.patientName}</span><StatusBadge status={r.status} />
            </Link>
          ))}
        </div>
      </section>
      <span className="xs muted">প্রতি ৩০ সেকেন্ডে নিজে থেকে আপডেট হয় · আয় = সম্পন্ন ভিজিট × চেম্বারের ফি (আনুমানিক)</span>
    </div>
  );
}
