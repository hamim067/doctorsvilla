import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { bookingLive } from "@/lib/live";
import { bn, formatDateBn } from "@/lib/time";

export const metadata = { title: "লাইভ সিরিয়াল", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS = { DONE: "সম্পন্ন", ABSENT: "অনুপস্থিত" } as const;

export default async function LivePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const d = await bookingLive((await params).id);
  if (!d) notFound();
  const { new: isNew } = await searchParams;
  const st = d.booking.status;

  return (
    <main className="live-wrap">
      <AutoRefresh seconds={15} />
      <div className="narrow stack" style={{ maxWidth: 480 }}>
        <div className="row between"><Link href={`/dr/${d.doctor.slug}`} style={{ color: "#fff" }}>← {d.doctor.name}</Link>
          <span className="badge" style={{ background: "rgba(255,255,255,.12)", color: "#fff" }}>● লাইভ · {d.updatedAt}</span></div>

        {isNew && (
          <p className="alert alert-ok">সিরিয়াল কনফার্ম হয়েছে! এসএমএসেও পাঠানো হয়েছে। এই পেজটা বুকমার্ক করে রাখুন।</p>
        )}

        <p style={{ textAlign: "center", color: "#b9d3cd" }}>{d.chamber.name} · {formatDateBn(d.booking.date)}</p>

        {d.isToday && st !== "CANCELLED" ? (
          <>
            <p style={{ textAlign: "center", color: "#b9d3cd", marginTop: 8 }}>এখন চলছে</p>
            {d.current ? <p className="live-num">{bn(d.current)}</p> : <p style={{ textAlign: "center", fontSize: 28, fontWeight: 600 }}>ডাক এখনো শুরু হয়নি</p>}
          </>
        ) : null}

        <div className="card stack" style={{ color: "var(--ink)" }}>
          <div className="row between">
            <div className="stack-sm" style={{ gap: 0 }}>
              <span className="muted small">{d.patientName} · আপনার সিরিয়াল</span>
              <span className="big-num" style={{ color: "var(--teal)", fontSize: 40 }}>{bn(d.booking.serialNo)}</span>
              <span className="muted small">{d.booking.code}</span>
            </div>
            {st === "WAITING" && d.isToday && (
              <div className="stack-sm" style={{ gap: 0, textAlign: "right" }}>
                <span className="muted small">আনুমানিক অপেক্ষা</span>
                <span className="big-num" style={{ color: "var(--orange)" }}>~{bn(d.etaMinutes)} মিনিট</span>
                <span className="muted small">আগে আর {bn(d.ahead)} জন</span>
              </div>
            )}
          </div>
          {st === "WAITING" && !d.isToday && <p className="alert alert-ok">চেম্বারের দিন এই পেজে লাইভ সিরিয়াল দেখা যাবে।</p>}
          {st === "WAITING" && d.isToday && d.ahead <= 2 && <p className="alert" style={{ background: "var(--orange-soft)", color: "var(--orange-ink)" }}>আপনার পালা প্রায় এসে গেছে — চেম্বারে চলে আসুন।</p>}
          {st === "IN_PROGRESS" && <p className="alert alert-ok">এখন আপনার পালা — ভেতরে যান।</p>}
          {st === "DONE" && <p className="alert alert-ok">আপনার ভিজিট সম্পন্ন হয়েছে।</p>}
          {st === "ABSENT" && <p className="alert alert-error">ডাকার সময় আপনাকে পাওয়া যায়নি। চেম্বারে পৌঁছে অ্যাসিস্ট্যান্টকে জানান — আবার লাইনে দেবেন।</p>}
          {st === "CANCELLED" && <p className="alert alert-error">এই সিরিয়াল বাতিল হয়েছে।</p>}
          {d.isToday && <p className="muted small">হিসাব: আজ প্রতি রোগীতে গড়ে {bn(d.avgMinutes)} মিনিট · {bn(d.done)}/{bn(d.total)} জন দেখা হয়েছে</p>}
        </div>

        {d.isToday && d.recent.length > 0 && (
          <div className="stack-sm">
            <span style={{ color: "#b9d3cd" }}>আজকের অবস্থা</span>
            {d.recent.map((r) => (
              <div key={r.serialNo} className="row between" style={{ background: "rgba(255,255,255,.07)", borderRadius: 12, padding: "10px 14px" }}>
                <span>সিরিয়াল {bn(r.serialNo)}</span><span style={{ color: r.status === "DONE" ? "#5bd6a4" : "#f3b48a", fontWeight: 600 }}>{STATUS[r.status as keyof typeof STATUS]}</span>
              </div>
            ))}
          </div>
        )}
        <p className="small" style={{ color: "#b9d3cd" }}>{d.chamber.address}, {d.chamber.city}</p>
      </div>
    </main>
  );
}
