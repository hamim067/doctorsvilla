import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Icon } from "@/components/Icons";
import { bookingLive } from "@/lib/live";
import { bn, formatDateBn } from "@/lib/time";
import "../../dr/patient.css";

export const metadata = { title: "লাইভ সিরিয়াল", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS = { DONE: ["সম্পন্ন", "#5BD6A4"], ABSENT: ["অনুপস্থিত", "#F3B48A"] } as const;
const SEG: Record<string, string> = { DONE: "#0B6E5F", ABSENT: "#8A6A55", IN_PROGRESS: "#C2551A", WAITING: "#DCE3E0", ME: "#5BD6A4" };

export default async function LivePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const d = await bookingLive((await params).id);
  if (!d) notFound();
  const { new: isNew } = await searchParams;
  const st = d.booking.status;
  const live = d.isToday && st !== "CANCELLED";

  return (
    <main className="lv">
      <AutoRefresh seconds={15} />
      <div className="pt-wrap lv-wrap">
        <header className="row-sb">
          <Link href={`/dr/${d.doctor.slug}`} className="pt-back"><Icon name="chevron" size={20} stroke={2.2} color="#fff" />{d.doctor.name}</Link>
          <span className="lv-pill"><span className="lv-dot" />{live ? "লাইভ" : "আপডেট"} · {d.updatedAt}</span>
        </header>

        {isNew && <p className="alert alert-ok">সিরিয়াল কনফার্ম হয়েছে! এসএমএসেও পাঠানো হয়েছে। এই পেজটা বুকমার্ক করে রাখুন।</p>}

        <p className="lv-sub">{d.chamber.name} · {formatDateBn(d.booking.date)}</p>

        {live && (
          <div className="col" style={{ alignItems: "center" }}>
            <span className="lv-sub">এখন চলছে</span>
            {d.current ? <span className="lv-num">{bn(d.current)}</span> : <span className="lv-wait">ডাক এখনো শুরু হয়নি</span>}
          </div>
        )}

        <section className="lv-card">
          <div className="row-sb" style={{ alignItems: "flex-end" }}>
            <span className="col">
              <span className="small muted">{d.patientName} · আপনার সিরিয়াল</span>
              <span className="lv-mine">{bn(d.booking.serialNo)}</span>
              <span className="xs muted">{d.booking.code}</span>
            </span>
            {st === "WAITING" && d.isToday && (
              <span className="col right">
                <span className="small muted">আনুমানিক অপেক্ষা</span>
                <span className="lv-eta">{d.ahead === 0 ? "আপনিই পরের জন" : `~${bn(d.etaMinutes)} মিনিট`}</span>
              </span>
            )}
          </div>

          {live && d.segments.length > 1 && (
            <div className="col" style={{ gap: 6 }}>
              <div className="lv-bar" style={{ gridTemplateColumns: `repeat(${d.segments.length}, minmax(0, 1fr))` }}>
                {d.segments.map((s, i) => <span key={i} style={{ background: SEG[s] ?? "#DCE3E0" }} />)}
              </div>
              {st === "WAITING" && <span className="small muted">আপনার আগে আর {bn(d.ahead)} জন</span>}
            </div>
          )}

          {st === "WAITING" && !d.isToday && <p className="lv-note ok">চেম্বারের দিন এই পেজেই লাইভ সিরিয়াল দেখা যাবে।</p>}
          {st === "WAITING" && d.isToday && d.ahead <= 2 && <p className="lv-note warn">আপনার পালা প্রায় এসে গেছে — চেম্বারে চলে আসুন।</p>}
          {st === "WAITING" && d.isToday && d.ahead > 2 && <p className="lv-note warn">২ জন বাকি থাকলে রওনা দিলেই ঠিক সময়ে পৌঁছাবেন।</p>}
          {st === "IN_PROGRESS" && <p className="lv-note ok">এখন আপনার পালা — ভেতরে যান।</p>}
          {st === "DONE" && <p className="lv-note ok">আপনার ভিজিট সম্পন্ন হয়েছে।</p>}
          {st === "ABSENT" && <p className="lv-note bad">ডাকার সময় আপনাকে পাওয়া যায়নি। চেম্বারে পৌঁছে অ্যাসিস্ট্যান্টকে জানান — আবার লাইনে দেবেন।</p>}
          {st === "CANCELLED" && <p className="lv-note bad">এই সিরিয়াল বাতিল হয়েছে।</p>}
          {d.isToday && <span className="xs muted">হিসাব: আজ প্রতি রোগীতে গড়ে {bn(d.avgMinutes)} মিনিট · {bn(d.done)}/{bn(d.total)} জন দেখা হয়েছে</span>}
        </section>

        {d.isToday && d.recent.length > 0 && (
          <section className="col" style={{ gap: 8 }}>
            <span className="lv-sub" style={{ textAlign: "left" }}>আজকের অবস্থা</span>
            {d.recent.map((r) => {
              const [label, color] = STATUS[r.status as keyof typeof STATUS];
              return (
                <div key={r.serialNo} className="lv-row"><span>সিরিয়াল {bn(r.serialNo)}</span><span style={{ color, fontWeight: 600 }}>{label}</span></div>
              );
            })}
          </section>
        )}

        <div className="lv-actions">
          <a className="lv-btn-o" href={`https://maps.google.com/?q=${encodeURIComponent(`${d.chamber.address}, ${d.chamber.city}`)}`} target="_blank" rel="noreferrer">
            <Icon name="pin" size={18} />চেম্বারের লোকেশন
          </a>
          <Link className="lv-btn" href={`/dr/${d.doctor.slug}`}>ডাক্তারের প্রোফাইল</Link>
        </div>
      </div>
    </main>
  );
}
