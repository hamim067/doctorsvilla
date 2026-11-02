import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icons";
import { upcomingDays } from "@/lib/booking";
import { familyOf, getPatientSession } from "@/lib/patient-auth";
import { addDays, bn, formatDateBn, formatTimeBn, today, WEEKDAYS_SHORT_BN, weekday } from "@/lib/time";
import "../../patient.css";
import { BookForm } from "./BookForm";

export const metadata = { title: "সিরিয়াল নিন" };
export const dynamic = "force-dynamic";

export default async function BookPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ chamber?: string }> }) {
  const { slug } = await params;
  const { chamber: wanted } = await searchParams;
  const [doctor] = await db.select().from(schema.doctors).where(eq(schema.doctors.slug, slug)).limit(1);
  if (!doctor) notFound();
  const chambers = await db.query.chambers.findMany({
    where: and(eq(schema.chambers.doctorId, doctor.id), eq(schema.chambers.active, true)),
    with: { schedules: true },
    orderBy: asc(schema.chambers.createdAt),
  });
  const chamber = chambers.find((c) => c.id === wanted) ?? chambers[0];
  if (!chamber) notFound();

  const ps = await getPatientSession();
  const family = ps ? (await familyOf(ps.accountId)).map((p) => ({ id: p.id, name: p.name, relation: p.relation })) : [];

  const t = today();
  const days = (await upcomingDays(chamber)).map((d) => ({
    ...d,
    top: d.date === t ? "আজ" : d.date === addDays(t, 1) ? "কাল" : WEEKDAYS_SHORT_BN[weekday(d.date)],
    num: formatDateBn(d.date, false).split(" ")[0],
    sub: !d.open ? (d.note ?? "বন্ধ") : d.onlineLeft > 0 ? `${bn(d.onlineLeft)} খালি` : "পূর্ণ",
    long: formatDateBn(d.date),
    startLabel: d.startTime ? formatTimeBn(d.startTime) : "",
  }));

  return (
    <main className="pt pt-plain">
      <header className="pt-top">
        <div className="pt-wrap row" style={{ gap: 8 }}>
          <Link href={`/dr/${slug}`} className="pt-iconbtn" aria-label="পেছনে"><Icon name="chevron" size={22} stroke={2.2} /></Link>
          <span className="col" style={{ gap: 0 }}>
            <b style={{ fontSize: 17 }}>সিরিয়াল বুকিং</b>
            <span className="small muted">{doctor.name} · {doctor.specialty}</span>
          </span>
        </div>
      </header>

      <div className="pt-wrap pt-stack" style={{ paddingTop: 18 }}>
        {!ps && (
          <p className="small muted">আগে সিরিয়াল নিয়েছেন? <Link href={`/me/login?next=${encodeURIComponent(`/dr/${slug}/book?chamber=${chamber.id}`)}`}>মোবাইল নাম্বারে লগইন করুন</Link> — পরিবারের সবার নাম আর নাম্বার আর লিখতে হবে না।</p>
        )}
        <section className="pt-sec">
          <h2>চেম্বার বেছে নিন</h2>
          {chambers.map((c) => {
            const on = c.id === chamber.id;
            return (
              <Link key={c.id} href={`?chamber=${c.id}`} className={`pt-radio${on ? " on" : ""}`} aria-current={on ? "page" : undefined}>
                <span className="pt-dot" aria-hidden="true"><span /></span>
                <span className="col grow" style={{ gap: 0 }}>
                  <b>{c.name}, {c.city}</b>
                  <span className="small muted">{c.address} · নতুন ৳{bn(c.feeNew)} / ফলোআপ ৳{bn(c.feeFollowUp)}</span>
                </span>
              </Link>
            );
          })}
        </section>

        <BookForm
          chamberId={chamber.id}
          days={days}
          avgMinutes={chamber.avgMinutes}
          patient={ps ? { phone: ps.phone, family } : null}
          summary={{ doctor: doctor.name, chamber: `${chamber.name}, ${chamber.city}`, feeNew: chamber.feeNew, feeFollowUp: chamber.feeFollowUp }}
        />
      </div>
    </main>
  );
}
