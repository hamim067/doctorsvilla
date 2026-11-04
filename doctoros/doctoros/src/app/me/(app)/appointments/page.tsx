import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { StatusBadge } from "@/components/StatusBadge";
import { familyOf, requirePatient } from "@/lib/patient-auth";
import { bn, formatDateBn, formatTimeBn, today, weekday } from "@/lib/time";
import { cancelBooking } from "../../actions";

export const metadata = { title: "আমার অ্যাপয়েন্টমেন্ট" };
export const dynamic = "force-dynamic";

export default async function MyAppointments() {
  const s = await requirePatient();
  const fam = await familyOf(s.accountId);
  if (fam.length === 0) {
    return (
      <div className="me-card stack">
        <h1>স্বাগতম!</h1>
        <p>এই নাম্বারে এখনো কোনো রোগীর প্রোফাইল নেই। প্রথমে নিজের বা পরিবারের সদস্যের নাম যোগ করুন, অথবা কোনো ডাক্তারের কাছে সিরিয়াল নিন।</p>
        <div className="row"><Link className="btn btn-primary" href="/me/family">সদস্য যোগ করুন</Link><Link className="btn" href="/">ডাক্তার খুঁজুন</Link></div>
      </div>
    );
  }
  const ids = fam.map((p) => p.id);
  const nameOf = new Map(fam.map((p) => [p.id, p.name]));
  const t = today();
  const { bookings, doctors, chambers, followUps, schedules } = schema;
  const base = () =>
    db.select({ b: bookings, doctorName: doctors.name, slug: doctors.slug, specialty: doctors.specialty, chamberName: chambers.name, city: chambers.city, chamberId: chambers.id })
      .from(bookings).innerJoin(doctors, eq(doctors.id, bookings.doctorId)).innerJoin(chambers, eq(chambers.id, bookings.chamberId));

  const [upcoming, past, fus, scheds] = await Promise.all([
    base().where(and(inArray(bookings.patientId, ids), gte(bookings.date, t), inArray(bookings.status, ["WAITING", "IN_PROGRESS"]))).orderBy(bookings.date, bookings.serialNo),
    base().where(and(inArray(bookings.patientId, ids), lt(bookings.date, t))).orderBy(desc(bookings.date)).limit(20),
    db.select({ fu: followUps, doctorName: doctors.name, slug: doctors.slug }).from(followUps).innerJoin(doctors, eq(doctors.id, followUps.doctorId))
      .where(and(inArray(followUps.patientId, ids), inArray(followUps.status, ["PENDING", "REMINDED", "MISSED"]))).orderBy(followUps.dueDate),
    db.select().from(schedules),
  ]);
  const startOf = (chamberId: string, date: string) => scheds.find((x) => x.chamberId === chamberId && x.weekday === weekday(date))?.startTime;
  const todays = upcoming.filter((u) => u.b.date === t);

  return (
    <div className="stack">
      <h1>আমার অ্যাপয়েন্টমেন্ট</h1>

      {todays.map((u) => (
        <Link key={u.b.id} href={`/live/${u.b.id}`} className="me-today">
          <div className="row-sb"><span className="badge badge-teal">আজ · সিরিয়াল {bn(u.b.serialNo)}</span><span className="small" style={{ color: "var(--orange)", fontWeight: 700 }}>লাইভ দেখুন →</span></div>
          <b style={{ fontSize: 17 }}>{u.doctorName}</b>
          <span className="small muted">{nameOf.get(u.b.patientId)} · {u.chamberName}, {u.city}</span>
        </Link>
      ))}

      {fus.map((f) => (
        <div key={f.fu.id} className="me-card me-fu stack-sm">
          <b style={{ color: "var(--orange-ink)" }}>{f.fu.status === "MISSED" ? "ফলোআপ মিস হয়েছে" : "ফলোআপ বাকি"}</b>
          <span>{f.doctorName} বলেছেন {formatDateBn(f.fu.dueDate)} আবার দেখাতে · {nameOf.get(f.fu.patientId)}</span>
          <div><Link className="btn btn-warn" href={`/dr/${f.slug}/book`}>ফলোআপ সিরিয়াল নিন</Link></div>
        </div>
      ))}

      <h2>আসন্ন</h2>
      {upcoming.filter((u) => u.b.date !== t).length === 0 && todays.length === 0 && (
        <div className="me-card stack-sm"><span className="muted">কোনো আসন্ন সিরিয়াল নেই।</span><div><Link className="btn btn-primary" href="/">ডাক্তার খুঁজুন</Link></div></div>
      )}
      {upcoming.filter((u) => u.b.date !== t).map((u) => {
        const st = startOf(u.chamberId, u.b.date);
        return (
          <div key={u.b.id} className="me-card me-appt">
            <div className="me-date"><span>{formatDateBn(u.b.date, false).split(" ")[1]}</span><b>{formatDateBn(u.b.date, false).split(" ")[0]}</b></div>
            <div className="col grow" style={{ gap: 2 }}>
              <Link href={`/live/${u.b.id}`} style={{ fontWeight: 700, color: "inherit" }}>{u.doctorName}</Link>
              <span className="small muted">{u.specialty} · {nameOf.get(u.b.patientId)} · সিরিয়াল {bn(u.b.serialNo)}</span>
              <span className="small muted">{u.chamberName}{st ? ` · ${formatTimeBn(st)} থেকে` : ""}</span>
            </div>
            <form action={cancelBooking}><input type="hidden" name="id" value={u.b.id} /><button className="btn" style={{ minHeight: 38 }}>বাতিল</button></form>
          </div>
        );
      })}

      {past.length > 0 && <h2>আগের</h2>}
      {past.map((u) => (
        <Link key={u.b.id} href={`/live/${u.b.id}`} className="me-card me-appt" style={{ color: "inherit" }}>
          <div className="me-date muted-date"><span>{formatDateBn(u.b.date, false).split(" ")[1]}</span><b>{formatDateBn(u.b.date, false).split(" ")[0]}</b></div>
          <div className="col grow" style={{ gap: 2 }}>
            <b>{u.doctorName}</b>
            <span className="small muted">{nameOf.get(u.b.patientId)} · {u.chamberName}</span>
          </div>
          <StatusBadge status={u.b.status} />
        </Link>
      ))}
      <p className="small muted">নতুন সিরিয়াল নিতে <Link href="/">ডাক্তার খুঁজুন</Link>।</p>
    </div>
  );
}
