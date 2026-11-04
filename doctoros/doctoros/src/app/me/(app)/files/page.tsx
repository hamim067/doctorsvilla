import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icons";
import { patientCode } from "@/lib/booking";
import { familyOf, requirePatient, selectedMember } from "@/lib/patient-auth";
import { bn, dateDhaka, formatDateBn } from "@/lib/time";

export const metadata = { title: "প্রেসক্রিপশন" };
export const dynamic = "force-dynamic";

/** বাছাই করা সদস্যের সব প্রেসক্রিপশন — কাগজের প্যাডের মতো কার্ড, প্রিন্ট/PDF আর WhatsApp-এ পাঠানো */
export default async function MyFiles() {
  const s = await requirePatient();
  const fam = await familyOf(s.accountId);
  if (!fam.length) return <div className="md-card"><p>আগে <Link href="/me/family">সদস্য যোগ করুন</Link>।</p></div>;
  const me = (await selectedMember(fam))!;
  const rows = await db.select({ v: schema.visits, date: schema.bookings.date, doctorName: schema.doctors.name, degrees: schema.doctors.degrees, specialty: schema.doctors.specialty })
    .from(schema.visits)
    .innerJoin(schema.doctors, eq(schema.doctors.id, schema.visits.doctorId))
    .leftJoin(schema.bookings, eq(schema.bookings.id, schema.visits.bookingId))
    .where(eq(schema.visits.patientId, me.id))
    .orderBy(desc(schema.visits.createdAt)).limit(60);

  return (
    <div className="md">
      <div className="col" style={{ gap: 4 }}>
        <h1>প্রেসক্রিপশন</h1>
        <span className="muted">{me.name} · {patientCode(me.number)} — ডাক্তার যা লিখেছেন, সব এখানে। নতুনটা সবার উপরে।</span>
      </div>
      {rows.length === 0 && <div className="md-card md-none">এখনো কোনো প্রেসক্রিপশন নেই। ডাক্তার লিখলে এখানে নিজে থেকেই চলে আসবে।</div>}
      {rows.map(({ v, date, doctorName, degrees, specialty }, i) => {
        const d = date ?? dateDhaka(v.createdAt);
        const share = [`প্রেসক্রিপশন — ${me.name}`, `${doctorName} · ${formatDateBn(d)}`, v.diagnosis || v.complaint ? `রোগ নির্ণয়: ${v.diagnosis || v.complaint}` : "",
          ...v.medicines.map((m, j) => `${bn(j + 1)}. ${m.name} — ${[m.dose, m.when, m.days].filter(Boolean).join(", ")}`),
          v.advice ? `পরামর্শ: ${v.advice}` : "", v.followUpDate ? `আবার দেখানোর দিন: ${formatDateBn(v.followUpDate)}` : ""].filter(Boolean).join("\n");
        return (
          <article key={v.id} className="rx-pad">
            <header className="rx-pad-h">
              <span className="col" style={{ gap: 0, minWidth: 0 }}>
                <b>{doctorName}</b>
                <small>{degrees} · {specialty}</small>
              </span>
              <span className="col right" style={{ gap: 2 }}>
                {i === 0 && <span className="badge badge-teal">সর্বশেষ</span>}
                <span className="rx-pad-date">{formatDateBn(d, false)} {bn(d.slice(0, 4))}</span>
              </span>
            </header>
            {(v.diagnosis || v.complaint) && <p className="rx-pad-dx"><span>রোগ নির্ণয়</span>{v.diagnosis || v.complaint}</p>}
            {v.medicines.length > 0 && (
              <ol className="rx-pad-meds">
                <span className="rx-pad-rx" aria-hidden>℞</span>
                {v.medicines.map((m, j) => (
                  <li key={j}><b>{m.name}</b><span>{[m.dose, m.when, m.days].filter(Boolean).join(" · ")}</span></li>
                ))}
              </ol>
            )}
            {v.advice && <p className="rx-pad-adv"><span>পরামর্শ</span>{v.advice}</p>}
            {v.followUpDate && <p className="rx-pad-fu"><Icon name="calendar" size={16} />আবার দেখানোর দিন: <b>{formatDateBn(v.followUpDate)}</b></p>}
            <footer className="rx-pad-f">
              <a className="btn" href={`/me/rx/${v.id}`} target="_blank" rel="noreferrer"><Icon name="external" size={16} />প্রিন্ট / PDF</a>
              <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer"><Icon name="chat" size={16} />WhatsApp-এ পাঠান</a>
            </footer>
          </article>
        );
      })}
    </div>
  );
}
