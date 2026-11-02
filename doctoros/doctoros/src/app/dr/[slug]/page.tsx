import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { bn, formatTimeBn, WEEKDAYS_BN } from "@/lib/time";

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
  // Google-এ "রাজশাহীতে হৃদরোগ ডাক্তার" খুঁজলে যেন আসে (PRD: ব্যক্তিগত ব্র্যান্ডিং)
  return { title: `${d.doctor.name} — ${d.doctor.specialty}, ${city}`, description: `${d.doctor.degrees}. ${d.doctor.specialty}, ${city}. অনলাইনে সিরিয়াল নিন।` };
}

// শনিবার থেকে সাজানো
const sortWeek = (a: { weekday: number }, b: { weekday: number }) => ((a.weekday + 1) % 7) - ((b.weekday + 1) % 7);

export default async function DoctorProfile({ params }: { params: Promise<{ slug: string }> }) {
  const data = await load((await params).slug);
  if (!data) notFound();
  const { doctor, chambers } = data;
  const initials = doctor.name.replace(/^ডা\.\s*/, "").slice(0, 2);
  return (
    <main>
      <div className="hero" style={{ paddingBottom: 72 }}>
        <div className="container" style={{ padding: "0 16px" }}><Link href="/" style={{ color: "#fff" }}>← DoctorOS</Link></div>
      </div>
      <div className="container stack" style={{ marginTop: -64, maxWidth: 760 }}>
        <div className="card stack">
          <div className="row" style={{ gap: 16, alignItems: "flex-start" }}>
            <div aria-hidden style={{ width: 80, height: 80, borderRadius: 18, background: "#d5e6e1", color: "var(--teal)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700 }}>{initials}</div>
            <div className="stack-sm" style={{ flex: 1, gap: 2 }}>
              <h1 style={{ fontSize: 24 }}>{doctor.name}</h1>
              <span className="muted">{doctor.degrees}</span>
              <span className="muted">{doctor.specialty}</span>
              <span className="row" style={{ marginTop: 6 }}>
                {doctor.bmdcVerified ? <span className="badge badge-teal">✓ BMDC যাচাইকৃত</span> : <span className="badge">BMDC: {doctor.bmdcNo}</span>}
                {doctor.experienceYears ? <span className="badge">{bn(doctor.experienceYears)} বছরের অভিজ্ঞতা</span> : null}
              </span>
            </div>
          </div>
          {doctor.bio && <p style={{ lineHeight: 1.7 }}>{doctor.bio}</p>}
        </div>

        <h2>চেম্বার</h2>
        {chambers.length === 0 && <p className="muted">এখনো কোনো চেম্বার যোগ হয়নি।</p>}
        {chambers.map((c) => (
          <div key={c.id} className="card stack-sm">
            <div className="row between">
              <strong style={{ fontSize: 17 }}>{c.name}</strong>
              <span>নতুন ৳{bn(c.feeNew)} · ফলোআপ ৳{bn(c.feeFollowUp)}</span>
            </div>
            <span className="muted small">{c.address}, {c.city}</span>
            <ul className="small" style={{ margin: "4px 0", paddingLeft: 18 }}>
              {[...c.schedules].sort(sortWeek).map((s) => (
                <li key={s.id}>{WEEKDAYS_BN[s.weekday]}: {formatTimeBn(s.startTime)} – {formatTimeBn(s.endTime)}</li>
              ))}
            </ul>
            <Link href={`/dr/${doctor.slug}/book?chamber=${c.id}`} className="btn btn-primary btn-big">এই চেম্বারে সিরিয়াল নিন</Link>
          </div>
        ))}
      </div>
    </main>
  );
}
