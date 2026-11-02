import { eq, ilike, or, sql } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { bn } from "@/lib/time";

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const term = q.trim();
  const like = `%${term}%`;
  const rows = await db
    .selectDistinctOn([schema.doctors.id], {
      slug: schema.doctors.slug,
      name: schema.doctors.name,
      degrees: schema.doctors.degrees,
      specialty: schema.doctors.specialty,
      verified: schema.doctors.bmdcVerified,
      city: schema.chambers.city,
      fee: schema.chambers.feeNew,
    })
    .from(schema.doctors)
    .innerJoin(schema.chambers, eq(schema.chambers.doctorId, schema.doctors.id))
    .where(
      term
        ? or(ilike(schema.doctors.name, like), ilike(schema.doctors.specialty, like), ilike(schema.chambers.city, like), ilike(schema.chambers.name, like))
        : sql`true`,
    )
    .limit(30);

  return (
    <main>
      <section className="hero">
        <div className="container stack" style={{ paddingTop: 8, paddingBottom: 0 }}>
          <div className="row between">
            <strong style={{ fontSize: 22 }}>DoctorOS</strong>
            <Link href="/login" style={{ color: "#fff" }}>ডাক্তার লগইন</Link>
          </div>
          <h1>ডাক্তার খুঁজুন, ঘরে বসে সিরিয়াল নিন</h1>
          <p style={{ opacity: 0.9 }}>সিরিয়াল নিন, বাসা থেকেই দেখুন এখন কত নম্বর চলছে।</p>
          <form className="row" role="search" style={{ background: "#fff", borderRadius: 14, padding: 6 }}>
            <label htmlFor="q" style={{ position: "absolute", left: -9999 }}>খুঁজুন</label>
            <input id="q" name="q" defaultValue={term} className="input" style={{ border: 0, flex: 1 }} placeholder="ডাক্তারের নাম, বিভাগ বা শহর" />
            <button className="btn btn-primary">খুঁজুন</button>
          </form>
        </div>
      </section>
      <div className="container stack">
        <h2>{term ? `"${term}" — ${bn(rows.length)} জন ডাক্তার` : "ডাক্তার"}</h2>
        {rows.length === 0 && <p className="muted">কোনো ডাক্তার পাওয়া যায়নি।</p>}
        <div className="grid">
          {rows.map((d) => (
            <Link key={d.slug} href={`/dr/${d.slug}`} className="card stack-sm" style={{ color: "inherit" }}>
              <strong style={{ fontSize: 17 }}>{d.name}</strong>
              <span className="muted small">{d.specialty} · {d.degrees}</span>
              <span className="row small"><span>{d.city}</span><span>· ফি ৳{bn(d.fee)}</span>{d.verified && <span className="badge badge-teal">BMDC যাচাইকৃত</span>}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
