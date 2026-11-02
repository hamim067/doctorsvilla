import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { AutoRefresh } from "@/components/AutoRefresh";
import { liveState } from "@/lib/queue";
import { bn, clockDhaka, formatTimeBn, today } from "@/lib/time";

export const metadata = { title: "সিরিয়াল ডিসপ্লে", robots: { index: false } };
export const dynamic = "force-dynamic";

// চেম্বারের টিভিতে ফুল-স্ক্রিনে খুলে রাখুন। রোগীর নাম দেখানো হয় না — শুধু নাম্বার।
export default async function TvPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [row] = await db
    .select({ chamber: schema.chambers, doctor: schema.doctors })
    .from(schema.chambers)
    .innerJoin(schema.doctors, eq(schema.doctors.id, schema.chambers.doctorId))
    .where(eq(schema.chambers.tvToken, token))
    .limit(1);
  if (!row) notFound();
  const st = (await liveState(row.chamber.id, today()))!;
  const next = st.waiting.slice(0, 3);
  return (
    <main className="tv">
      <AutoRefresh seconds={5} />
      <div className="row between">
        <div className="stack-sm" style={{ gap: 0 }}>
          <span style={{ fontSize: "clamp(24px, 3.5vw, 56px)", fontWeight: 700 }}>{row.doctor.name}</span>
          <span style={{ fontSize: "clamp(16px, 2vw, 30px)", color: "#b9d3cd" }}>{row.doctor.specialty} · {row.chamber.name}</span>
        </div>
        <span style={{ fontSize: "clamp(20px, 2.5vw, 40px)", color: "#b9d3cd" }}>{formatTimeBn(clockDhaka(new Date()))}</span>
      </div>
      <div className="row" style={{ flex: 1, alignItems: "stretch", gap: "3vw" }}>
        <section className="tv-now" aria-live="assertive">
          <span style={{ fontSize: "clamp(24px, 3.5vw, 52px)", color: "#d3efe8" }}>এখন চলছে</span>
          {st.current ? <span className="n">{bn(st.current.serialNo)}</span> : <span style={{ fontSize: "clamp(40px, 7vw, 120px)", fontWeight: 700, margin: "4vh 0" }}>শীঘ্রই শুরু হবে</span>}
          <span style={{ fontSize: "clamp(20px, 3vw, 44px)", fontWeight: 600 }}>{st.current ? "অনুগ্রহ করে ভেতরে আসুন" : "একটু অপেক্ষা করুন"}</span>
        </section>
        <section className="tv-next">
          <span style={{ fontSize: "clamp(20px, 2.6vw, 40px)", fontWeight: 700, color: "#b9d3cd" }}>পরের সিরিয়াল</span>
          {next.length === 0 && <span style={{ fontSize: 28, color: "#b9d3cd" }}>—</span>}
          {next.map((r, i) => (
            <div key={r.id} className="item">
              <span className="n">{bn(r.serialNo)}</span>
              <span style={{ fontSize: "clamp(16px, 2.2vw, 36px)", fontWeight: 600, color: i === 0 ? "#f3b48a" : "#b9d3cd" }}>{i === 0 ? "প্রস্তুত থাকুন" : "অপেক্ষমাণ"}</span>
            </div>
          ))}
        </section>
      </div>
      <div className="row between" style={{ fontSize: "clamp(14px, 1.8vw, 30px)", color: "#b9d3cd" }}>
        <span>আজকের মোট সিরিয়াল: {bn(st.total)} · গড়ে {bn(st.avg)} মিনিট প্রতি রোগী</span>
        <span style={{ fontWeight: 700, color: "#5bd6a4" }}>DoctorOS</span>
      </div>
    </main>
  );
}
