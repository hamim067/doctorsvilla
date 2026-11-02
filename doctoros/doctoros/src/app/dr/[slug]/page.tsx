import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icons";
import { getSession } from "@/lib/auth";
import { dayAvailability, upcomingDays } from "@/lib/booking";
import { siteOrigin } from "@/lib/qr";
import { hasEnglish, hasPremium, loadSite, normalize, patientsSeen } from "@/lib/site";
import { addDays, bn, formatDateBn, formatTimeBn, today, WEEKDAYS_BN } from "@/lib/time";
import "../patient.css";
import "../site.css";
import { DoctorWebsite, type WsChamber } from "./Website";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  const [doctor] = await db.select().from(schema.doctors).where(eq(schema.doctors.slug, slug)).limit(1);
  if (!doctor) return null;
  const chambers = await db.query.chambers.findMany({
    where: and(eq(schema.chambers.doctorId, doctor.id), eq(schema.chambers.active, true)),
    with: { schedules: true },
    orderBy: asc(schema.chambers.createdAt),
  });
  const site = await loadSite(doctor.id);
  return { doctor, chambers, site };
}

/** ওয়েবসাইট দেখাবে কিনা: প্রকাশিত + Premium; অথবা ডাক্তার নিজে ?preview=1 দিয়ে দেখছেন */
async function websiteMode(d: NonNullable<Awaited<ReturnType<typeof load>>>, preview: boolean) {
  const live = Boolean(d.site?.published && hasPremium(d.doctor));
  if (live) return { show: true, preview: null };
  if (!preview) return { show: false, preview: null };
  const s = await getSession();
  if (!s || s.doctorId !== d.doctor.id) return { show: false, preview: null };
  return { show: true, preview: (hasPremium(d.doctor) ? "draft" : "plan") as "draft" | "plan" };
}

const WEEK_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function timeEn(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
function linesFor(list: { weekday: number; startTime: string; endTime: string }[], lang: "bn" | "en") {
  const groups = new Map<string, number[]>();
  for (const s of [...list].sort(sortWeek)) {
    const k = `${s.startTime}-${s.endTime}`;
    groups.set(k, [...(groups.get(k) ?? []), s.weekday]);
  }
  const dn = (w: number) => (lang === "bn" ? WEEKDAYS_BN[w].replace("বার", "") : WEEK_EN[w]);
  return [...groups.entries()].map(([k, days]) => {
    const [st, en] = k.split("-");
    // টানা দিন হলে "শনি–বুধ", নইলে কমা দিয়ে
    const order = days.map((w) => (w + 1) % 7);
    const run = order.every((o, i) => i === 0 || o === order[i - 1] + 1);
    const names = days.length === 7 ? (lang === "bn" ? "প্রতিদিন" : "Every day") : run && days.length > 2 ? `${dn(days[0])}–${dn(days[days.length - 1])}` : days.map(dn).join(", ");
    return lang === "bn" ? `${names} · ${formatTimeBn(st)} – ${formatTimeBn(en)}` : `${names} · ${timeEn(st)} – ${timeEn(en)}`;
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = await load((await params).slug);
  if (!d) return {};
  const city = d.chambers[0]?.city ?? "";
  // Google-এ "রাজশাহীতে হৃদরোগ ডাক্তার" খুঁজলে যেন আসে
  const title = `${d.doctor.name} — ${d.doctor.specialty}${city ? `, ${city}` : ""}`;
  const description = `${d.doctor.degrees}. ${d.doctor.specialty}${city ? `, ${city}` : ""}. অনলাইনে সিরিয়াল নিন।`;
  const live = d.site?.published && hasPremium(d.doctor);
  const origin = await siteOrigin();
  const image = live && d.site?.hasPhoto ? `${origin}/dr/${d.doctor.slug}/photo?v=${d.site.updatedAt.getTime()}` : undefined;
  return {
    title: { absolute: title }, description,
    alternates: { canonical: `${origin}/dr/${d.doctor.slug}` },
    openGraph: { title, description, type: "profile", url: `${origin}/dr/${d.doctor.slug}`, images: image ? [{ url: image }] : undefined },
  };
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

export default async function DoctorProfile({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> }) {
  const data = await load((await params).slug);
  if (!data) notFound();
  const mode = await websiteMode(data, (await searchParams).preview === "1");
  if (mode.show) return <Website data={data} preview={mode.preview} />;
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

/** Premium ওয়েবসাইট — সার্ভারে সব তথ্য গুছিয়ে ক্লায়েন্ট কম্পোনেন্টে পাঠানো */
async function Website({ data, preview }: { data: NonNullable<Awaited<ReturnType<typeof load>>>; preview: "draft" | "plan" | null }) {
  const { doctor, chambers, site } = data;
  const content = normalize(site?.content, doctor);
  const t = today();
  const tomorrow = addDays(t, 1);
  const [seen, ups] = await Promise.all([patientsSeen(doctor.id), Promise.all(chambers.map((c) => upcomingDays(c)))]);
  const wsChambers: WsChamber[] = chambers.map((c, i) => {
    const days = ups[i];
    const td = days.find((x) => x.date === t);
    const off = [0, 1, 2, 3, 4, 5, 6].filter((w) => !c.schedules.some((s) => s.weekday === w)).sort((a, b) => ((a + 1) % 7) - ((b + 1) % 7));
    return {
      id: c.id, name: c.name, address: c.address, city: c.city, feeNew: c.feeNew, feeFollowUp: c.feeFollowUp,
      schedBn: linesFor(c.schedules, "bn"), schedEn: linesFor(c.schedules, "en"),
      offBn: off.length && off.length < 7 ? off.map((w) => WEEKDAYS_BN[w]).join(", ") : "",
      offEn: off.length && off.length < 7 ? off.map((w) => WEEK_EN[w]).join(", ") : "",
      todayBn: !td?.open ? "আজ বন্ধ" : td.onlineLeft > 0 ? `আজ ${bn(td.onlineLeft)}টি অনলাইন সিরিয়াল খালি` : "আজকের অনলাইন সিরিয়াল শেষ",
      todayEn: !td?.open ? "Closed today" : td.onlineLeft > 0 ? `${td.onlineLeft} online serials left today` : "Today's online serials are full",
      todayCls: !td?.open ? "muted" : td.onlineLeft > 0 ? "ok" : "warn",
      days: days.filter((x) => x.open && x.onlineLeft > 0).slice(0, 10).map((x) => {
        const [, m, dnum] = x.date.split("-").map(Number);
        const wd = new Date(`${x.date}T00:00:00Z`).getUTCDay();
        const relBn = x.date === t ? "আজ, " : x.date === tomorrow ? "কাল, " : "";
        const relEn = x.date === t ? "Today, " : x.date === tomorrow ? "Tomorrow, " : "";
        return {
          date: x.date,
          bn: `${relBn}${formatDateBn(x.date)}${x.startTime ? ` · ${formatTimeBn(x.startTime)}` : ""} (${bn(x.onlineLeft)}টি খালি)`,
          en: `${relEn}${WEEK_EN[wd]}, ${dnum} ${MONTH_EN[m - 1]}${x.startTime ? ` · ${timeEn(x.startTime)}` : ""} (${x.onlineLeft} left)`,
        };
      }),
    };
  });
  const todays = ups.map((d) => d.find((x) => x.date === t));
  const openToday = todays.some((x) => x?.open && x.onlineLeft > 0) ? "open" : todays.some((x) => x?.open) ? "full" : "closed";
  const origin = await siteOrigin();
  const photo = site?.hasPhoto ? `/dr/${doctor.slug}/photo?v=${site.updatedAt.getTime()}` : null;

  // Google-এর জন্য গোছানো তথ্য (schema.org Physician)
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Physician",
    name: doctor.name, description: content.bn.heroText || content.bn.designation,
    medicalSpecialty: doctor.specialty, url: `${origin}/dr/${doctor.slug}`,
    ...(photo ? { image: `${origin}${photo}` } : {}),
    ...(content.hotline ? { telephone: content.hotline } : {}),
    address: chambers.map((c) => ({ "@type": "PostalAddress", streetAddress: c.address, addressLocality: c.city, addressCountry: "BD" })),
  };

  return (
    <>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" precedence="default" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <DoctorWebsite d={{
        slug: doctor.slug, name: doctor.name, degrees: doctor.degrees, bmdcNo: doctor.bmdcNo, verified: doctor.bmdcVerified,
        photo, content, english: hasEnglish(content),
        stats: { experience: doctor.experienceYears, patients: seen, chambers: chambers.length },
        chambers: wsChambers, openToday, preview, year: Number(t.slice(0, 4)),
      }} />
    </>
  );
}
