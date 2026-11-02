import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { CopyButton } from "@/components/CopyButton";
import { requireDoctor } from "@/lib/auth";
import { doctorChambers } from "@/lib/chambers";
import { qrPng, qrSvg, siteOrigin } from "@/lib/qr";

export const metadata = { title: "শেয়ার ও QR কোড" };

export default async function SharePage() {
  const s = await requireDoctor();
  const [d] = await db.select().from(schema.doctors).where(eq(schema.doctors.id, s.doctorId)).limit(1);
  const chambers = await doctorChambers(s.doctorId);
  const url = `${await siteOrigin()}/dr/${d.slug}`;
  const [svg, png] = await Promise.all([qrSvg(url), qrPng(url)]);
  const wa = `https://wa.me/?text=${encodeURIComponent(`${d.name}-এর কাছে অনলাইনে সিরিয়াল নিন: ${url}`)}`;
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  return (
    <>
      <div className="stack-sm" style={{ gap: 2 }}>
        <h1>শেয়ার ও QR কোড</h1>
        <span className="muted">রোগী QR স্ক্যান করলেই আপনার প্রোফাইল খুলবে, সেখান থেকে সিরিয়াল নিতে পারবেন।</span>
      </div>

      <div className="row" style={{ alignItems: "stretch", gap: 20 }}>
        <div className="card stack" style={{ flex: "2 1 420px", minWidth: 0 }}>
          <h2>আপনার প্রোফাইল লিংক</h2>
          <div className="row" style={{ background: "var(--ground)", borderRadius: 12, padding: "10px 14px" }}>
            <code style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere", fontSize: 15 }}>{url}</code>
            <CopyButton text={url} />
          </div>
          <div className="row">
            <a className="btn" href={wa} target="_blank" rel="noreferrer">হোয়াটসঅ্যাপে পাঠান</a>
            <a className="btn" href={fb} target="_blank" rel="noreferrer">Facebook-এ শেয়ার</a>
          </div>
          <p className="muted small">টিপ: Facebook পেজের "Book Now" বাটনে আর Google Business প্রোফাইলের ওয়েবসাইট ঘরে এই লিংকটা বসান।</p>
        </div>
        <div className="card stack" style={{ flex: "1 1 260px", alignItems: "center", textAlign: "center" }}>
          <div style={{ width: 200, height: 200 }} dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label="প্রোফাইলের QR কোড" />
          <a className="btn btn-primary" href={png} download={`${d.slug}-qr.png`}>QR ডাউনলোড (PNG)</a>
        </div>
      </div>

      <div className="card stack">
        <h2>প্রিন্ট করার জিনিস</h2>
        <p className="muted small">প্রিন্ট পেজ খুলে ব্রাউজারের Print (Ctrl + P) চাপুন, অথবা PDF হিসেবে সেভ করে প্রেসে দিন।</p>
        <div className="grid">
          {chambers.map((c) => (
            <a key={c.id} className="card stack-sm" href={`/print/poster?chamber=${c.id}`} target="_blank" rel="noreferrer" style={{ color: "inherit", background: "var(--ground)" }}>
              <strong>চেম্বারের পোস্টার (A4)</strong>
              <span className="muted small">{c.name} — দেয়ালে লাগানোর জন্য, বড় QR সহ</span>
            </a>
          ))}
          <a className="card stack-sm" href="/print/poster?card=1" target="_blank" rel="noreferrer" style={{ color: "inherit", background: "var(--ground)" }}>
            <strong>ভিজিটিং কার্ড</strong>
            <span className="muted small">এক পাতায় ১০টি কার্ড, QR সহ</span>
          </a>
        </div>
      </div>
    </>
  );
}
