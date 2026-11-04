import { and, desc, eq, gte, inArray } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icons";
import { patientCode } from "@/lib/booking";
import { familyOf, requirePatient } from "@/lib/patient-auth";
import { bn, dateDhaka, formatDateBn, formatTimeBn, thisYear, today, weekday } from "@/lib/time";
import { toRow, vitalsForPatients } from "@/lib/vitals";
import { VitalsPanel } from "@/components/Vitals";

export const metadata = { title: "আমার ড্যাশবোর্ড" };
export const dynamic = "force-dynamic";

const TINTS = [["#D5E6E1", "#0B6E5F"], ["#FFE6D5", "#8A3A10"], ["#E5E3F3", "#3E3577"], ["#E1ECF7", "#1F4E7A"]];
function greet() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", hour12: false }).format(new Date()));
  return h < 12 ? "শুভ সকাল" : h < 17 ? "শুভ দুপুর" : h < 20 ? "শুভ সন্ধ্যা" : "শুভ রাত্রি";
}

/** রোগীর ড্যাশবোর্ড — আজকের সিরিয়াল, পরের অ্যাপয়েন্টমেন্ট, ফলোআপ, সর্বশেষ প্রেসক্রিপশন আর স্বাস্থ্যের রিডিং এক জায়গায় */
export default async function MeHome({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const s = await requirePatient();
  const fam = await familyOf(s.accountId);
  if (fam.length === 0) {
    return (
      <div className="md-empty">
        <span className="md-empty-ic"><Icon name="family" size={30} /></span>
        <h1>স্বাগতম!</h1>
        <p>এই নম্বরে এখনো কোনো রোগীর প্রোফাইল নেই। কোনো ডাক্তারের কাছে এই নম্বর দিয়ে সিরিয়াল নিলে সব তথ্য এখানে নিজে থেকেই চলে আসবে।</p>
        <div className="row"><Link className="btn btn-primary" href="/">ডাক্তার খুঁজুন</Link><Link className="btn" href="/me/family">সদস্য যোগ করুন</Link></div>
      </div>
    );
  }
  const { p } = await searchParams;
  const me = fam.find((x) => x.id === p) ?? fam[0];
  const ids = fam.map((x) => x.id);
  const nameOf = new Map(fam.map((x) => [x.id, x.name]));
  const t = today();
  const { bookings, doctors, chambers, followUps, visits, schedules } = schema;

  const [upcoming, fus, lastRx, vit, stats, scheds] = await Promise.all([
    db.select({ b: bookings, doctorName: doctors.name, specialty: doctors.specialty, chamberName: chambers.name, city: chambers.city })
      .from(bookings).innerJoin(doctors, eq(doctors.id, bookings.doctorId)).innerJoin(chambers, eq(chambers.id, bookings.chamberId))
      .where(and(inArray(bookings.patientId, ids), gte(bookings.date, t), inArray(bookings.status, ["WAITING", "IN_PROGRESS"])))
      .orderBy(bookings.date, bookings.serialNo).limit(5),
    db.select({ fu: followUps, doctorName: doctors.name, slug: doctors.slug }).from(followUps).innerJoin(doctors, eq(doctors.id, followUps.doctorId))
      .where(and(inArray(followUps.patientId, ids), inArray(followUps.status, ["PENDING", "REMINDED", "MISSED"]))).orderBy(followUps.dueDate).limit(3),
    db.select({ v: visits, doctorName: doctors.name }).from(visits).innerJoin(doctors, eq(doctors.id, visits.doctorId))
      .where(eq(visits.patientId, me.id)).orderBy(desc(visits.createdAt)).limit(1),
    vitalsForPatients([me.id], 40),
    db.select({ visits: bookings.id }).from(bookings).where(and(inArray(bookings.patientId, ids), eq(bookings.status, "DONE"))),
    db.select().from(schedules),
  ]);
  const todays = upcoming.filter((u) => u.b.date === t);
  const next = upcoming.find((u) => u.b.date !== t);
  const rx = lastRx[0];
  const vrows = vit.map(({ v, doctorName }) => toRow(v, v.source === "PATIENT" ? "নিজে" : doctorName ?? "ডাক্তার"));
  const startOf = (chamberId: string, date: string) => scheds.find((x) => x.chamberId === chamberId && x.weekday === weekday(date))?.startTime;
  const age = me.birthYear ? thisYear() - me.birthYear : null;

  return (
    <div className="md">
      <section className="md-hero">
        <div className="col" style={{ gap: 4 }}>
          <span className="md-greet">{greet()} 👋</span>
          <h1>{fam[0].name}</h1>
          <span className="md-sub">{s.phone} · পরিবারের {bn(fam.length)} জন · মোট ভিজিট {bn(stats.length)}</span>
        </div>
        <Link href="/" className="md-hero-cta"><Icon name="search" size={18} />নতুন সিরিয়াল</Link>
      </section>

      {fam.length > 1 && (
        <nav className="md-members" aria-label="সদস্য বাছুন">
          {fam.map((m, i) => (
            <Link key={m.id} href={`/me?p=${m.id}`} className={m.id === me.id ? "on" : ""} aria-current={m.id === me.id ? "page" : undefined}>
              <span className="md-av" style={{ background: TINTS[i % 4][0], color: TINTS[i % 4][1] }}>{m.name.slice(0, 1)}</span>
              <span className="col"><b>{m.name}</b><small>{m.relation ?? "সদস্য"}</small></span>
            </Link>
          ))}
        </nav>
      )}

      {todays.map((u) => (
        <Link key={u.b.id} href={`/live/${u.b.id}`} className="md-today">
          <span className="md-today-n"><small>সিরিয়াল</small><b>{bn(u.b.serialNo)}</b></span>
          <span className="col grow" style={{ gap: 2 }}>
            <span className="md-live"><i />আজ · লাইভ দেখুন</span>
            <b>{u.doctorName}</b>
            <span className="small">{nameOf.get(u.b.patientId)} · {u.chamberName}, {u.city}</span>
          </span>
          <Icon name="chevron" size={22} />
        </Link>
      ))}

      {fus.map((f) => (
        <div key={f.fu.id} className="md-alert">
          <span className="md-alert-ic"><Icon name="bell" size={20} /></span>
          <span className="col grow" style={{ gap: 2 }}>
            <b>{f.fu.status === "MISSED" ? "ফলোআপ মিস হয়েছে" : "ফলোআপ বাকি"}</b>
            <span className="small">{f.doctorName} — {formatDateBn(f.fu.dueDate)} · {nameOf.get(f.fu.patientId)}</span>
          </span>
          <Link className="btn btn-warn btn-sm2" href={`/dr/${f.slug}/book`}>সিরিয়াল নিন</Link>
        </div>
      ))}

      <div className="md-grid">
        <section className="md-card">
          <header className="md-card-h"><span className="md-ic t1"><Icon name="calendar" size={18} /></span><h2>পরের অ্যাপয়েন্টমেন্ট</h2><Link href="/me/appointments" className="md-more">সব দেখুন</Link></header>
          {next ? (
            <div className="md-appt">
              <span className="md-date"><small>{formatDateBn(next.b.date, false).split(" ")[1]}</small><b>{formatDateBn(next.b.date, false).split(" ")[0]}</b></span>
              <span className="col grow" style={{ gap: 2 }}>
                <b>{next.doctorName}</b>
                <span className="small muted">{next.specialty} · সিরিয়াল {bn(next.b.serialNo)}</span>
                <span className="small muted">{next.chamberName}{startOf(next.b.chamberId, next.b.date) ? ` · ${formatTimeBn(startOf(next.b.chamberId, next.b.date)!)} থেকে` : ""}</span>
              </span>
            </div>
          ) : <p className="muted small">{todays.length ? "আজকের পরে আর কোনো সিরিয়াল নেই।" : "কোনো আসন্ন সিরিয়াল নেই।"} <Link href="/">ডাক্তার খুঁজুন →</Link></p>}
        </section>

        <section className="md-card">
          <header className="md-card-h"><span className="md-ic t2"><Icon name="pill" size={18} /></span><h2>সর্বশেষ প্রেসক্রিপশন</h2><Link href={`/me/files?p=${me.id}`} className="md-more">ফাইল</Link></header>
          {rx ? (
            <div className="col" style={{ gap: 8 }}>
              <span className="small muted">{rx.doctorName} · {formatDateBn(dateDhaka(rx.v.createdAt), false)}</span>
              {(rx.v.diagnosis || rx.v.complaint) && <b>{rx.v.diagnosis || rx.v.complaint}</b>}
              <ul className="md-meds">
                {rx.v.medicines.slice(0, 4).map((m, i) => <li key={i}><b>{m.name}</b><span>{[m.dose, m.when, m.days].filter(Boolean).join(" · ")}</span></li>)}
              </ul>
              {rx.v.medicines.length > 4 && <span className="small muted">আরও {bn(rx.v.medicines.length - 4)}টি ওষুধ…</span>}
              {rx.v.followUpDate && <span className="small" style={{ color: "var(--orange-ink)", fontWeight: 600 }}>ফলোআপ: {formatDateBn(rx.v.followUpDate)}</span>}
            </div>
          ) : <p className="muted small">{me.name}-এর এখনো কোনো ডিজিটাল প্রেসক্রিপশন নেই। ডাক্তার লিখলে এখানে নিজে থেকেই চলে আসবে।</p>}
        </section>
      </div>

      <section className="md-card">
        <header className="md-card-h"><span className="md-ic t3"><Icon name="heart" size={18} /></span><h2>{me.name}-এর স্বাস্থ্য</h2><Link href={`/me/health?p=${me.id}`} className="md-more">বিস্তারিত</Link></header>
        <span className="small muted">{patientCode(me.number)}{age ? ` · ${bn(age)} বছর` : ""} — ডাক্তার বা আপনি যে রিডিং দেবেন, তারিখ অনুযায়ী এখানে জমা থাকবে।</span>
        <VitalsPanel rows={vrows} compact canAdd={false} />
      </section>

      <nav className="md-quick" aria-label="দ্রুত কাজ">
        <Link href="/me/health"><span className="md-ic t3"><Icon name="plus" size={18} /></span>প্রেসার/সুগার লিখুন</Link>
        <Link href="/me/files"><span className="md-ic t2"><Icon name="shield" size={18} /></span>প্রেসক্রিপশন</Link>
        <Link href="/me/appointments"><span className="md-ic t1"><Icon name="calendar" size={18} /></span>সিরিয়াল</Link>
        <Link href="/me/family"><span className="md-ic t4"><Icon name="family" size={18} /></span>পরিবার</Link>
      </nav>
      <p className="md-privacy"><Icon name="shield" size={14} />আপনার তথ্য শুধু আপনি আর যে ডাক্তারকে দেখিয়েছেন তিনি দেখতে পান।</p>
    </div>
  );
}
