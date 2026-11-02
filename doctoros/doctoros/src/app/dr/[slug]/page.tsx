import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icons";
import { dayAvailability } from "@/lib/booking";
import { bn, formatTimeBn, today, WEEKDAYS_BN } from "@/lib/time";
import "../patient.css";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  const [doctor] = await db.select().from(schema.doctors).where(eq(schema.doctors.slug, slug)).limit(1);
  if (!doctor) return null;
  const chambers = await db.query.chambers.findMany({
    where: and(eq(schema.chambers.doctorId, doctor.id), eq(schema.chambers.active, true)),
    with: { schedules: true },
    orderBy: asc(schema.chambers.createdAt),
  });
  return { doctor, chambers };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = await load((await params).slug);
  if (!d) return {};
  const city = d.chambers[0]?.city ?? "";
  // Google-এ "রাজশাহীতে হৃদরোগ ডাক্তার" খুঁজলে যেন আসে
  return { title: `${d.doctor.name} — ${d.doctor.specialty}, ${city}`, description: `${d.doctor.degrees}. ${d.doctor.specialty}, ${city}. অনলাইনে সিরিয়াল নিন।` };
}

// শনিবার থেকে সাজানো
const sortWeek = (a: { weekday: number }, b: { weekday: number }) => ((a.weekday + 1) % 7) - ((b.weekday + 1) % 7);

/** একই সময়ের দিনগুলো এক লাইনে: "শনি–বুধ · সন্ধ্যা ৬:০০ – রাত ৯:০০" */
function scheduleLines(list: { weekday: number; startTime: string; endTime: string }[]) {
  const groups = new Map<string, number[]>();
  for (const s of [...list].sort(sortWeek)) {
    const k = `${s.startTime}-${s.endTime}`;
    groups.set(k, [...(groups.get(k) ?? []), s.weekday]);
  }
  return [...groups.entries()].map(([k, days]) => {
    const [st, en] = k.split("-");
    const names = days.map((d) => WEEKDAYS_BN[d].replace("বার", ""));
    return `${names.length > 2 ? `${names[0]}–${names[names.length - 1]}` : names.join(", ")} · ${formatTimeBn(st)} – ${formatTimeBn(en)}`;
  });
}

export default async function DoctorProfile({ params }: { params: Promise<{ slug: string }> }) {
  const data = await load((await params).slug);
  if (!data) notFound();
  const { doctor, chambers } = data;
  const t = today();
  const todays = await Promise.all(chambers.map((c) => dayAvailability(c.id, t)));
  const minFee = chambers.length ? Math.min(...chambers.map((c) => c.feeNew)) : null;
  const initials = doctor.name.replace(/^ডা\.?\s*/, "").slice(0, 2);
  const firstBook = chambers[0] ? `/dr/${doctor.slug}/book?chamber=${chambers[0].id}` : null;

  return (
    <main className="pt">
      <div className="pt-band">
        <div className="pt-wrap row-sb">
          <Link href="/" className="pt-back"><Icon name="chevron" size={20} stroke={2.2} color="#fff" />DoctorOS</Link>
        </div>
      </div>

      <div className="pt-wrap pt-stack pt-lift">
        <section className="pt-card">
          <div className="pt-doc">
            <span className="pt-av">{initials}</span>
            <div className="col" style={{ gap: 2, minWidth: 0 }}>
              <h1>{doctor.name}</h1>
              <span className="muted">{doctor.degrees}</span>
              <span className="muted">{doctor.specialty}</span>
              {doctor.bmdcVerified ? (
                <span className="pt-verified"><Icon name="check" size={14} stroke={3} />BMDC যাচাইকৃত</span>
              ) : (
                <span className="pt-chip">BMDC: {doctor.bmdcNo}</span>
              )}
            </div>
          </div>
          <div className="pt-stats">
            <div><b>{doctor.experienceYears ? bn(doctor.experienceYears) : "—"}</b><span>বছরের অভিজ্ঞতা</span></div>
            <div><b>{bn(chambers.length)}</b><span>চেম্বার</span></div>
            <div><b>{minFee !== null ? `৳${bn(minFee)}` : "—"}</b><span>ভিজিট ফি</span></div>
          </div>
        </section>

        {doctor.bio && (
          <section className="pt-sec">
            <h2>পরিচিতি</h2>
            <p className="pt-bio">{doctor.bio}</p>
          </section>
        )}

        <section className="pt-sec">
          <h2>চেম্বার</h2>
          {chambers.length === 0 && <p className="muted">এখনো কোনো চেম্বার যোগ হয়নি।</p>}
          {chambers.map((c, i) => {
            const a = todays[i];
            const status = !a.open
              ? { text: `আজ বন্ধ`, cls: "muted" }
              : a.onlineLeft > 0
                ? { text: `আজ ${bn(a.onlineLeft)}টি সিরিয়াল খালি`, cls: "ok" }
                : { text: "আজকের অনলাইন সিরিয়াল শেষ", cls: "warn" };
            return (
              <Link key={c.id} href={`/dr/${doctor.slug}/book?chamber=${c.id}`} className="pt-chamber">
                <div className="row-sb" style={{ alignItems: "flex-start" }}>
                  <span className="col" style={{ gap: 2 }}>
                    <b>{c.name}</b>
                    <span className="small muted"><Icon name="pin" size={14} color="#55635F" /> {c.address}, {c.city}</span>
                  </span>
                  <span className="pt-fee">৳{bn(c.feeNew)}<small>ফলোআপ ৳{bn(c.feeFollowUp)}</small></span>
                </div>
                {scheduleLines(c.schedules).map((l) => <span key={l} className="small">{l}</span>)}
                <span className={`pt-status ${status.cls}`}>{status.text}</span>
              </Link>
            );
          })}
        </section>
      </div>

      {firstBook && (
        <div className="pt-bottom">
          <div className="pt-wrap">
            <Link href={firstBook} className="pt-cta">সিরিয়াল নিন</Link>
          </div>
        </div>
      )}
    </main>
  );
}
