import { and, desc, eq, gte, inArray } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icons";
import { MedsToday } from "@/components/MedsToday";
import { currentMeds, splitList } from "@/lib/meds";
import { familyOf, requirePatient, selectedMember } from "@/lib/patient-auth";
import { liveState } from "@/lib/queue";
import { bn, dateDhaka, formatDateBn, formatTimeBn, today, weekday } from "@/lib/time";
import { toRow, vitalsForPatients } from "@/lib/vitals";
import { HelpTip } from "./HelpTip";

export const metadata = { title: "আমার ড্যাশবোর্ড" };
export const dynamic = "force-dynamic";

function greet() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", hour12: false }).format(new Date()));
  return h < 12 ? "শুভ সকাল" : h < 17 ? "শুভ দুপুর" : h < 20 ? "শুভ সন্ধ্যা" : "শুভ রাত্রি";
}
/** সাধারণ রেফারেন্স সীমা — সহজ চিহ্ন, রোগ নির্ণয় নয় */
const bpOk = (s: number, d: number) => (s >= 140 || d >= 90 ? "hi" : s < 90 || d < 60 ? "lo" : "ok");
const sgOk = (v: number, w: string | null) => (v < 3.9 ? "lo" : (w === "fasting" && v >= 7) || v >= 11.1 ? "hi" : "ok");
const WORD = { ok: "ঠিক আছে", hi: "একটু বেশি", lo: "একটু কম" } as const;

/**
 * রোগীর হোম — উপর থেকে নিচে প্রশ্নের মতো সাজানো:
 * আজ কী? → আজ কোন ওষুধ? → আবার কবে যাব? → প্রেসার-সুগার কেমন? → কী করতে চান?
 */
export default async function MeHome() {
  const s = await requirePatient();
  const fam = await familyOf(s.accountId);
  if (fam.length === 0) {
    return (
      <div className="md-empty">
        <span className="md-empty-ic"><Icon name="family" size={30} /></span>
        <h1>স্বাগতম!</h1>
        <p>এই নম্বরে এখনো কোনো রোগীর তথ্য নেই। কোনো ডাক্তারের কাছে এই নম্বর দিয়ে সিরিয়াল নিলে সব তথ্য এখানে নিজে থেকেই চলে আসবে।</p>
        <div className="row"><Link className="btn btn-primary" href="/">ডাক্তার খুঁজুন</Link><Link className="btn" href="/me/family">সদস্য যোগ করুন</Link></div>
      </div>
    );
  }
  const me = (await selectedMember(fam))!;
  const t = today();
  const { bookings, doctors, chambers, followUps, visits, schedules } = schema;

  const [upcoming, fus, vis, vit, scheds] = await Promise.all([
    db.select({ b: bookings, doctorName: doctors.name, slug: doctors.slug, chamberName: chambers.name, city: chambers.city })
      .from(bookings).innerJoin(doctors, eq(doctors.id, bookings.doctorId)).innerJoin(chambers, eq(chambers.id, bookings.chamberId))
      .where(and(eq(bookings.patientId, me.id), gte(bookings.date, t), inArray(bookings.status, ["WAITING", "IN_PROGRESS"])))
      .orderBy(bookings.date, bookings.serialNo).limit(5),
    db.select({ fu: followUps, doctorName: doctors.name, slug: doctors.slug }).from(followUps).innerJoin(doctors, eq(doctors.id, followUps.doctorId))
      .where(and(eq(followUps.patientId, me.id), inArray(followUps.status, ["PENDING", "REMINDED", "MISSED"]))).orderBy(followUps.dueDate).limit(2),
    db.select({ v: visits, date: bookings.date, doctorName: doctors.name }).from(visits)
      .innerJoin(doctors, eq(doctors.id, visits.doctorId)).leftJoin(bookings, eq(bookings.id, visits.bookingId))
      .where(eq(visits.patientId, me.id)).orderBy(desc(visits.createdAt)).limit(20),
    vitalsForPatients([me.id], 20),
    db.select().from(schedules),
  ]);
  const todays = upcoming.filter((u) => u.b.date === t);
  const later = upcoming.filter((u) => u.b.date !== t);
  const live = await Promise.all(todays.map(async (u) => {
    const st = await liveState(u.b.chamberId, t);
    const ahead = st ? st.waiting.filter((r) => r.serialNo < u.b.serialNo).length + (st.current ? 1 : 0) : 0;
    return { now: st?.current?.serialNo ?? null, ahead };
  }));
  const meds = currentMeds(vis.map(({ v, date, doctorName }) => ({ date: date ?? dateDhaka(v.createdAt), medicines: v.medicines, doctorName })), t);
  const rows = vit.map(({ v }) => toRow(v, ""));
  const bp = rows.find((r) => r.sys !== null), sg = rows.find((r) => r.sugar !== null), wt = rows.find((r) => r.weight !== null);
  const startOf = (chamberId: string, date: string) => scheds.find((x) => x.chamberId === chamberId && x.weekday === weekday(date))?.startTime;
  const allergies = splitList(me.allergies);

  return (
    <div className="md">
      <p className="md-hello">{greet()}! 👋 <span>{me.relation === "নিজে" || fam[0].id === me.id ? "আপনার" : `${me.name}-এর`} আজকের সব তথ্য নিচে।</span></p>
      <HelpTip />

      {allergies.length > 0 && <p className="md-allergy"><Icon name="alert" size={18} />অ্যালার্জি: <b>{allergies.join(", ")}</b> — নতুন ডাক্তারকে অবশ্যই বলবেন</p>}

      {/* ১. আজ */}
      {todays.map((u, i) => (
        <Link key={u.b.id} href={`/live/${u.b.id}`} className="md-today">
          <span className="md-today-n"><small>আপনার নম্বর</small><b>{bn(u.b.serialNo)}</b></span>
          <span className="col grow" style={{ gap: 3 }}>
            <span className="md-live"><i />আজ ডাক্তার দেখানোর দিন</span>
            <b className="md-today-doc">{u.doctorName}</b>
            <span className="md-today-q">
              {live[i].now ? <>এখন চলছে <b>{bn(live[i].now!)}</b> · আপনার আগে <b>{bn(live[i].ahead)}</b> জন</> : <>এখনো শুরু হয়নি · আপনার আগে <b>{bn(live[i].ahead)}</b> জন</>}
            </span>
            <span className="small">{u.chamberName}, {u.city}</span>
          </span>
          <span className="md-go">লাইভ দেখুন<Icon name="chevron" size={20} /></span>
        </Link>
      ))}

      {/* ২. আজকের ওষুধ */}
      <section className="md-card">
        <header className="md-card-h"><span className="md-ic t2"><Icon name="pill" size={20} /></span><h2>আজ কোন ওষুধ খাবেন</h2><Link href="/me/files" className="md-more">প্রেসক্রিপশন →</Link></header>
        <MedsToday meds={meds} empty="এখন কোনো চলমান ওষুধ নেই। ডাক্তার প্রেসক্রিপশন দিলে এখানে সকাল-দুপুর-রাত ভাগ করে দেখাবে।" />
      </section>

      {/* ৩. আবার কবে */}
      <section className="md-card">
        <header className="md-card-h"><span className="md-ic t1"><Icon name="calendar" size={20} /></span><h2>আবার কবে ডাক্তার দেখাবেন</h2><Link href="/me/appointments" className="md-more">সব সিরিয়াল →</Link></header>
        {later.map((u) => (
          <div key={u.b.id} className="md-appt">
            <span className="md-date"><small>{formatDateBn(u.b.date, false).split(" ")[1]}</small><b>{formatDateBn(u.b.date, false).split(" ")[0]}</b></span>
            <span className="col grow" style={{ gap: 2 }}>
              <b>{u.doctorName}</b>
              <span className="small">সিরিয়াল {bn(u.b.serialNo)} · {u.chamberName}{startOf(u.b.chamberId, u.b.date) ? ` · ${formatTimeBn(startOf(u.b.chamberId, u.b.date)!)} থেকে` : ""}</span>
            </span>
            <span className="badge badge-teal">সিরিয়াল নেওয়া আছে</span>
          </div>
        ))}
        {fus.map((f) => (
          <div key={f.fu.id} className="md-appt md-due">
            <span className="md-date warn"><small>{formatDateBn(f.fu.dueDate, false).split(" ")[1]}</small><b>{formatDateBn(f.fu.dueDate, false).split(" ")[0]}</b></span>
            <span className="col grow" style={{ gap: 2 }}>
              <b>{f.doctorName}</b>
              <span className="small">{f.fu.status === "MISSED" ? "আবার দেখানোর দিন পেরিয়ে গেছে" : "ডাক্তার এই দিনে আবার দেখাতে বলেছেন"}</span>
            </span>
            <Link className="btn btn-warn" href={`/dr/${f.slug}/book`}>সিরিয়াল নিন</Link>
          </div>
        ))}
        {!later.length && !fus.length && <p className="md-none">এখন কোনো সিরিয়াল বা আবার দেখানোর দিন নেই। <Link href="/">ডাক্তার খুঁজুন →</Link></p>}
      </section>

      {/* ৪. প্রেসার ও সুগার */}
      <section className="md-card">
        <header className="md-card-h"><span className="md-ic t3"><Icon name="heart" size={20} /></span><h2>প্রেসার ও সুগার কেমন</h2><Link href="/me/health" className="md-more">গ্রাফ →</Link></header>
        <div className="md-vit">
          <div className={`md-v ${bp ? bpOk(bp.sys!, bp.dia!) : "none"}`}>
            <small>প্রেসার</small>
            {bp ? <><b>{bn(bp.sys!)}/{bn(bp.dia!)}</b><span>{WORD[bpOk(bp.sys!, bp.dia!)]}</span><em>{formatDateBn(bp.date, false)}</em></> : <span>এখনো নেই</span>}
          </div>
          <div className={`md-v ${sg ? sgOk(sg.sugar!, sg.sugarWhen) : "none"}`}>
            <small>সুগার</small>
            {sg ? <><b>{bn(sg.sugar!)}</b><span>{WORD[sgOk(sg.sugar!, sg.sugarWhen)]}</span><em>{formatDateBn(sg.date, false)}</em></> : <span>এখনো নেই</span>}
          </div>
          <div className="md-v nt">
            <small>ওজন</small>
            {wt ? <><b>{bn(wt.weight!)} kg</b><em>{formatDateBn(wt.date, false)}</em></> : <span>এখনো নেই</span>}
          </div>
        </div>
        <Link href="/me/health" className="btn btn-block md-add-v"><Icon name="plus" size={18} />আজকের প্রেসার/সুগার লিখুন</Link>
      </section>

      {/* ৫. কী করতে চান */}
      <section>
        <h2 className="md-q">কী করতে চান?</h2>
        <nav className="md-quick" aria-label="দ্রুত কাজ">
          <Link href="/"><span className="md-ic t1"><Icon name="search" size={22} /></span>নতুন সিরিয়াল নিন</Link>
          <Link href="/me/files"><span className="md-ic t2"><Icon name="pill" size={22} /></span>প্রেসক্রিপশন দেখুন</Link>
          <Link href="/me/health"><span className="md-ic t3"><Icon name="heart" size={22} /></span>প্রেসার/সুগার লিখুন</Link>
          <Link href="/me/family"><span className="md-ic t4"><Icon name="family" size={22} /></span>পরিবারের সদস্য</Link>
        </nav>
      </section>
      <p className="md-privacy"><Icon name="shield" size={16} />আপনার তথ্য শুধু আপনি আর যে ডাক্তারকে দেখিয়েছেন তিনি দেখতে পান।</p>
    </div>
  );
}
