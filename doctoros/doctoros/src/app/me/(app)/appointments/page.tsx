import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icons";
import { StatusBadge } from "@/components/StatusBadge";
import { familyOf, requirePatient, selectedMember } from "@/lib/patient-auth";
import { bn, formatDateBn, formatTimeBn, today, weekday } from "@/lib/time";
import { cancelBooking } from "../../actions";

export const metadata = { title: "আমার সিরিয়াল" };
export const dynamic = "force-dynamic";

/** বাছাই করা সদস্যের সিরিয়াল — "সামনে" আর "আগের" দুটো আলাদা ট্যাবে */
export default async function MyAppointments({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const s = await requirePatient();
  const fam = await familyOf(s.accountId);
  if (fam.length === 0) return <div className="md-card"><p>আগে <Link href="/me/family">সদস্য যোগ করুন</Link> অথবা <Link href="/">ডাক্তার খুঁজে</Link> সিরিয়াল নিন।</p></div>;
  const me = (await selectedMember(fam))!;
  const tab = (await searchParams).tab === "past" ? "past" : "next";
  const t = today();
  const { bookings, doctors, chambers, followUps, schedules } = schema;
  const base = () =>
    db.select({ b: bookings, doctorName: doctors.name, slug: doctors.slug, specialty: doctors.specialty, chamberName: chambers.name, city: chambers.city })
      .from(bookings).innerJoin(doctors, eq(doctors.id, bookings.doctorId)).innerJoin(chambers, eq(chambers.id, bookings.chamberId));
  const [upcoming, past, fus, scheds] = await Promise.all([
    base().where(and(eq(bookings.patientId, me.id), gte(bookings.date, t), inArray(bookings.status, ["WAITING", "IN_PROGRESS"]))).orderBy(bookings.date, bookings.serialNo),
    base().where(and(eq(bookings.patientId, me.id), lt(bookings.date, t))).orderBy(desc(bookings.date)).limit(40),
    db.select({ fu: followUps, doctorName: doctors.name, slug: doctors.slug }).from(followUps).innerJoin(doctors, eq(doctors.id, followUps.doctorId))
      .where(and(eq(followUps.patientId, me.id), inArray(followUps.status, ["PENDING", "REMINDED", "MISSED"]))).orderBy(followUps.dueDate),
    db.select().from(schedules),
  ]);
  const startOf = (chamberId: string, date: string) => scheds.find((x) => x.chamberId === chamberId && x.weekday === weekday(date))?.startTime;

  return (
    <div className="md">
      <div className="row-sb"><h1>সিরিয়াল</h1><Link href="/" className="btn btn-primary"><Icon name="plus" size={18} />নতুন সিরিয়াল</Link></div>
      <nav className="md-tabs" aria-label="সিরিয়াল">
        <Link href="?tab=next" className={tab === "next" ? "on" : ""} aria-current={tab === "next" ? "page" : undefined}>সামনে ({bn(upcoming.length + fus.length)})</Link>
        <Link href="?tab=past" className={tab === "past" ? "on" : ""} aria-current={tab === "past" ? "page" : undefined}>আগের ({bn(past.length)})</Link>
      </nav>

      {tab === "next" && (
        <>
          {fus.map((f) => (
            <div key={f.fu.id} className="md-card md-appt md-due">
              <span className="md-date warn"><small>{formatDateBn(f.fu.dueDate, false).split(" ")[1]}</small><b>{formatDateBn(f.fu.dueDate, false).split(" ")[0]}</b></span>
              <span className="col grow" style={{ gap: 2 }}>
                <b>{f.doctorName}</b>
                <span className="small">{f.fu.status === "MISSED" ? "আবার দেখানোর দিন পেরিয়ে গেছে" : "ডাক্তার এই দিনে আবার দেখাতে বলেছেন"} — এখনো সিরিয়াল নেওয়া হয়নি</span>
              </span>
              <Link className="btn btn-warn" href={`/dr/${f.slug}/book`}>সিরিয়াল নিন</Link>
            </div>
          ))}
          {upcoming.map((u) => {
            const st = startOf(u.b.chamberId, u.b.date);
            const isToday = u.b.date === t;
            return (
              <div key={u.b.id} className={`md-card md-appt${isToday ? " md-is-today" : ""}`}>
                <span className="md-date"><small>{isToday ? "আজ" : formatDateBn(u.b.date, false).split(" ")[1]}</small><b>{formatDateBn(u.b.date, false).split(" ")[0]}</b></span>
                <span className="col grow" style={{ gap: 2, minWidth: 0 }}>
                  <b>{u.doctorName}</b>
                  <span className="small">{u.specialty}</span>
                  <span className="small">সিরিয়াল <b>{bn(u.b.serialNo)}</b> · {u.chamberName}{st ? ` · ${formatTimeBn(st)} থেকে` : ""}</span>
                </span>
                <span className="md-appt-act">
                  <Link className="btn btn-primary" href={`/live/${u.b.id}`}>লাইভ দেখুন</Link>
                  {u.b.status === "WAITING" && <form action={cancelBooking}><input type="hidden" name="id" value={u.b.id} /><button className="btn">বাতিল করুন</button></form>}
                </span>
              </div>
            );
          })}
          {upcoming.length === 0 && fus.length === 0 && <div className="md-card md-none">সামনে কোনো সিরিয়াল নেই। <Link href="/">ডাক্তার খুঁজে সিরিয়াল নিন →</Link></div>}
        </>
      )}

      {tab === "past" && (
        <>
          {past.length === 0 && <div className="md-card md-none">আগের কোনো সিরিয়াল নেই।</div>}
          {past.map((u) => (
            <Link key={u.b.id} href={`/live/${u.b.id}`} className="md-card md-appt" style={{ color: "inherit" }}>
              <span className="md-date muted-date"><small>{formatDateBn(u.b.date, false).split(" ")[1]}</small><b>{formatDateBn(u.b.date, false).split(" ")[0]}</b></span>
              <span className="col grow" style={{ gap: 2 }}><b>{u.doctorName}</b><span className="small">{u.chamberName} · সিরিয়াল {bn(u.b.serialNo)}</span></span>
              <StatusBadge status={u.b.status} />
            </Link>
          ))}
        </>
      )}
    </div>
  );
}
