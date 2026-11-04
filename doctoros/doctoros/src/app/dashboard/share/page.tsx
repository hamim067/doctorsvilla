import { eq } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { CopyButton } from "@/components/CopyButton";
import { Icon } from "@/components/Icons";
import { requireDoctor } from "@/lib/auth";
import { doctorAssetUrls } from "@/lib/assets";
import { doctorChambers } from "@/lib/chambers";
import { qrPng, qrSvg, siteOrigin } from "@/lib/qr";
import { normalizePad, sampleData } from "@/lib/rxpad";
import { normalizeCard } from "@/lib/vcard";
import { buildCardData } from "@/lib/vcard-data";
import { CardDesigner } from "./CardDesigner";
import { PadDesigner } from "./PadDesigner";
import "../../print/rxpad.css";
import "../../print/vcard.css";
import "./share.css";

export const metadata = { title: "শেয়ার ও QR কোড" };
export const dynamic = "force-dynamic";

const TABS = [
  { k: "link", label: "লিংক ও QR", icon: "arrow" },
  { k: "pad", label: "প্রেসক্রিপশন প্যাড", icon: "pill" },
  { k: "card", label: "ভিজিটিং কার্ড", icon: "user" },
  { k: "print", label: "পোস্টার ও প্রিন্ট", icon: "layout" },
] as const;
type Tab = (typeof TABS)[number]["k"];

export default async function SharePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const s = await requireDoctor();
  const wanted = (await searchParams).tab;
  const tab: Tab = TABS.find((t) => t.k === wanted)?.k ?? "link";
  const [d] = await db.select().from(schema.doctors).where(eq(schema.doctors.id, s.doctorId)).limit(1);
  const url = `${await siteOrigin()}/dr/${d.slug}`;
  const pad = normalizePad(d.rxPad);

  return (
    <div className="sh">
      <div className="sh-top">
        <h1>শেয়ার ও QR কোড</h1>
        <span className="muted">রোগী আপনাকে খুঁজে পাক, সিরিয়াল নিক — আর আপনার প্যাড, কার্ড, পোস্টার এক জায়গায়।</span>
      </div>

      <nav className="sh-tabs" aria-label="শেয়ার ও প্রিন্ট">
        {TABS.map((x) => (
          <Link key={x.k} href={`?tab=${x.k}`} className={tab === x.k ? "on" : ""} aria-current={tab === x.k ? "page" : undefined} scroll={false}>
            <Icon name={x.icon} size={18} />{x.label}
          </Link>
        ))}
      </nav>

      {tab === "link" && <LinkTab url={url} slug={d.slug} name={d.name} />}

      {tab === "pad" && await (async () => {
        const chambers = await doctorChambers(s.doctorId);
        const sample = { ...sampleData({ name: d.name, degrees: d.degrees, specialty: d.specialty, bmdcNo: d.bmdcNo }, chambers[0] ? { name: chambers[0].name, address: chambers[0].address, city: chambers[0].city } : null), qrSvg: await qrSvg(url), url, ...(await doctorAssetUrls(d.id, d.slug)) };
        return (
          <section className="stack">
            <p className="sh-lead">ফরম্যাট বাছুন, রং আর কোন অংশ থাকবে ঠিক করুন — প্রেসক্রিপশন প্রিন্ট আর রোগীর PDF দুটোই এই ডিজাইনে হবে।</p>
            <PadDesigner initial={pad} sample={sample} />
          </section>
        );
      })()}

      {tab === "card" && await (async () => {
        const card = d.card ? normalizeCard(d.card) : { ...normalizeCard(null), color: pad.color };
        return (
          <section className="stack">
            <p className="sh-lead">ফরম্যাট আর রং বাছুন — নাম, ডিগ্রি, চেম্বার, সময়, লোগো আর QR নিজে থেকেই বসে যাবে। সেভ করে এক পাতায় ১০টি প্রিন্ট করুন।</p>
            <CardDesigner initial={card} data={await buildCardData(d)} contact={{ phone: pad.phone, website: pad.website, email: pad.email, hospital: pad.hospital }} />
          </section>
        );
      })()}

      {tab === "print" && await (async () => {
        const chambers = await doctorChambers(s.doctorId);
        const items = [
          ...chambers.map((c) => ({ href: `/print/poster?chamber=${c.id}`, t: "চেম্বারের পোস্টার (A4)", d: `${c.name} — দেয়ালে লাগানোর জন্য, বড় QR সহ`, i: "layout" as const })),
          { href: "/print/rx-sample?blank=1", t: "খালি প্রেসক্রিপশন প্যাড", d: "আপনার বাছা ডিজাইনে — ছাপিয়ে হাতে লেখার জন্য", i: "pill" as const },
          { href: "/print/card", t: "ভিজিটিং কার্ড", d: "আপনার বাছা ডিজাইনে — এক পাতায় ১০টি", i: "user" as const },
        ];
        return (
          <section className="stack">
            <p className="sh-lead">খুলে ব্রাউজারের Print (Ctrl + P) চাপুন, অথবা PDF হিসেবে সেভ করে প্রেসে দিন।</p>
            <div className="sh-prints">
              {items.map((x) => (
                <a key={x.href} className="card sh-print" href={x.href} target="_blank" rel="noreferrer">
                  <span className="sh-ic"><Icon name={x.i} size={22} /></span>
                  <span className="col" style={{ gap: 2, minWidth: 0 }}><b>{x.t}</b><span className="small muted">{x.d}</span></span>
                  <Icon name="external" size={18} />
                </a>
              ))}
            </div>
            <p className="small muted">ডিজাইন বদলাতে: <Link href="?tab=pad" scroll={false}>প্রেসক্রিপশন প্যাড</Link> · <Link href="?tab=card" scroll={false}>ভিজিটিং কার্ড</Link></p>
          </section>
        );
      })()}
    </div>
  );
}

async function LinkTab({ url, slug, name }: { url: string; slug: string; name: string }) {
  const [svg, png] = await Promise.all([qrSvg(url), qrPng(url)]);
  const wa = `https://wa.me/?text=${encodeURIComponent(`${name}-এর কাছে অনলাইনে সিরিয়াল নিন: ${url}`)}`;
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  return (
    <div className="sh-link">
      <div className="card stack">
        <h2>আপনার প্রোফাইল লিংক</h2>
        <div className="sh-url"><code>{url}</code><CopyButton text={url} /></div>
        <div className="sh-btns">
          <a className="btn" href={wa} target="_blank" rel="noreferrer">হোয়াটসঅ্যাপে পাঠান</a>
          <a className="btn" href={fb} target="_blank" rel="noreferrer">Facebook-এ শেয়ার</a>
          <a className="btn" href={url} target="_blank" rel="noreferrer"><Icon name="external" size={16} />খুলে দেখুন</a>
        </div>
        <p className="muted small">টিপ: Facebook পেজের &quot;Book Now&quot; বাটনে আর Google Business প্রোফাইলের ওয়েবসাইট ঘরে এই লিংকটা বসান।</p>
      </div>
      <div className="card stack sh-qr">
        <div className="sh-qrimg" dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label="প্রোফাইলের QR কোড" />
        <a className="btn btn-primary" href={png} download={`${slug}-qr.png`}>QR ডাউনলোড (PNG)</a>
        <span className="small muted">স্ক্যান করলেই প্রোফাইল খুলবে, সেখান থেকে সিরিয়াল।</span>
      </div>
    </div>
  );
}
