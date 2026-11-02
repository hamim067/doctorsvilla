import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { upcomingDays } from "@/lib/booking";
import { addDays, bn, formatDateBn, today, WEEKDAYS_SHORT_BN, weekday } from "@/lib/time";
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

  const t = today();
  const days = (await upcomingDays(chamber)).map((d) => ({
    ...d,
    label: d.date === t ? "আজ" : d.date === addDays(t, 1) ? "কাল" : `${WEEKDAYS_SHORT_BN[weekday(d.date)]} ${formatDateBn(d.date, false).split(" ")[0]}`,
    sub: !d.open ? (d.note ?? "বন্ধ") : d.onlineLeft > 0 ? `${bn(d.onlineLeft)} খালি` : "পূর্ণ",
  }));

  return (
    <main className="narrow stack" style={{ maxWidth: 640 }}>
      <Link href={`/dr/${slug}`} className="small">← {doctor.name}</Link>
      <h1>সিরিয়াল নিন</h1>
      <p className="muted">{doctor.name} · {doctor.specialty}</p>
      {chambers.length > 1 && (
        <nav className="row" aria-label="চেম্বার">
          {chambers.map((c) => (
            <Link key={c.id} href={`?chamber=${c.id}`} className={c.id === chamber.id ? "btn btn-primary" : "btn"} aria-current={c.id === chamber.id ? "page" : undefined}>{c.name}</Link>
          ))}
        </nav>
      )}
      <div className="card small">{chamber.name} · {chamber.address}, {chamber.city} · নতুন ৳{bn(chamber.feeNew)} / ফলোআপ ৳{bn(chamber.feeFollowUp)}</div>
      <BookForm chamberId={chamber.id} days={days} />
    </main>
  );
}
