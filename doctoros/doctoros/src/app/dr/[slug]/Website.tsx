"use client";
import { Fragment, useActionState, useEffect, useState } from "react";
import { bookOnline } from "@/app/dr/actions";
import { Icon, type ICON } from "@/components/Icons";
import { keepValues } from "@/components/keepValues";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { SiteBlock, SiteContent, SiteText } from "@/db/schema";
import { parseVideo } from "@/lib/video";
import { postDate } from "@/lib/post-date";

type Lang = "bn" | "en";
export type WsDay = { date: string; bn: string; en: string };
export type WsChamber = {
  id: string; name: string; address: string; city: string;
  feeNew: number; feeFollowUp: number;
  schedBn: string[]; schedEn: string[]; offBn: string; offEn: string;
  todayBn: string; todayEn: string; todayCls: "ok" | "warn" | "muted";
  days: WsDay[];
};
export type WsData = {
  slug: string; name: string; degrees: string; bmdcNo: string; verified: boolean;
  photo: string | null; content: SiteContent; english: boolean;
  stats: { experience: number | null; patients: number; chambers: number };
  chambers: WsChamber[];
  openToday: "open" | "full" | "closed";
  preview: "draft" | "plan" | null;
  year: number;
};

const D = (s: string) => s.replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
const fmt = (n: number, lang: Lang) => (lang === "bn" ? D(n.toLocaleString("en-IN")) : n.toLocaleString("en-IN"));

const UI = {
  bn: {
    home: "মূল পাতা", about: "পরিচিতি", services: "চিকিৎসা সেবাসমূহ", chambers: "চেম্বার ও সময়সূচি", faq: "জিজ্ঞাসা",
    book: "সিরিয়াল নিন", bookNow: "অনলাইনে সিরিয়াল নিন", whatsapp: "WhatsApp-এ যোগাযোগ", call: "কল করুন",
    bmdc: "বিএমডিসি রেজি নং", verified: "BMDC যাচাইকৃত", hotline: "সিরিয়াল হটলাইন",
    open: "আজ চেম্বার খোলা • অনলাইন সিরিয়াল চলছে", full: "আজকের অনলাইন সিরিয়াল শেষ • আগামী দিনের সিরিয়াল নিন", closed: "অনলাইনে আগাম সিরিয়াল নেওয়া যায়",
    exp: "বছরের অভিজ্ঞতা", pts: "রোগী দেখেছেন (DoctorsVilla)", chs: "চেম্বার",
    servicesEyebrow: "বিশেষজ্ঞ চিকিৎসা সেবা", aboutEyebrow: "ডাক্তার সম্পর্কে", quals: "শিক্ষা ও যোগ্যতা", experience: "অভিজ্ঞতা", years: "বছর",
    chambersEyebrow: "কোথায় দেখাবেন", feeNew: "নতুন রোগী", feeFu: "ফলোআপ", off: "বন্ধ", map: "ম্যাপে দেখুন",
    bookEyebrow: "অনলাইন সিরিয়াল", bookTitle: "চেম্বারে দেখাতে আজই সিরিয়াল নিন", bookText: "ফর্ম পূরণ করলেই সাথে সাথে সিরিয়াল নম্বর পাবেন, আর মোবাইলে লাইভ দেখতে পারবেন কখন আপনার পালা।",
    name: "রোগীর নাম", phone: "মোবাইল নম্বর (01XXXXXXXXX)", chamber: "চেম্বার", date: "তারিখ", noDays: "আগামী ১৪ দিনে অনলাইন সিরিয়াল খালি নেই — হটলাইনে কল করুন",
    submit: "সিরিয়াল নিশ্চিত করুন", sending: "সিরিয়াল নেওয়া হচ্ছে…",
    faqEyebrow: "সাধারণ জিজ্ঞাসা", faqTitle: "রোগীরা যা জানতে চান",
    fChambers: "চেম্বারসমূহ", fLinks: "প্রয়োজনীয় লিংক", fContact: "যোগাযোগ ও সিরিয়াল", emergency: "জরুরি সতর্কবার্তা:",
    rights: "সর্বস্বত্ব সংরক্ষিত।", made: "DoctorsVilla দিয়ে তৈরি", menu: "মেনু",
    draft: "প্রিভিউ — ওয়েবসাইট এখনো প্রকাশ হয়নি। শুধু আপনি দেখছেন।",
    queue: "লাইভ সিরিয়াল", videos: "ভিডিও", blog: "স্বাস্থ্য টিপস", videosEyebrow: "দেখে জানুন", videosTitle: "স্বাস্থ্য বিষয়ক ভিডিও", blogEyebrow: "পড়ে জানুন", blogTitle: "স্বাস্থ্য টিপস ও লেখা", readMore: "পুরোটা পড়ুন", play: "ভিডিও চালান", queueEyebrow: "আজকের সিরিয়াল", queueTitle: "এখন কত নম্বর চলছে, কতজন অপেক্ষায়",
    nowServing: "এখন চলছে", qTotal: "আজ মোট", qWaiting: "অপেক্ষায়", qDone: "দেখা হয়েছে", perPt: "মিনিট/রোগী (গড়)",
    notStarted: "এখনো শুরু হয়নি", closedToday: "আজ এই চেম্বার বন্ধ", noSerial: "আজ এখনো কোনো সিরিয়াল নেই",
    lgWait: "অপেক্ষায়", lgNow: "চলছে", lgDone: "দেখা হয়েছে", lgAbsent: "অনুপস্থিত", updated: "আপডেট",
    findTitle: "আমার সিরিয়াল খুঁজুন", findText: "মোবাইল নম্বর আর সিরিয়াল কোড দিন (এসএমএস-এ পাঠানো, যেমন RAJ-1102-07)।",
    findPhone: "মোবাইল নম্বর", findCode: "সিরিয়াল কোড", findBtn: "খুঁজুন", finding: "খোঁজা হচ্ছে…",
    findNo: "এই নম্বর আর কোড মিলিয়ে কোনো সিরিয়াল পাওয়া যায়নি।", findFmt: "সঠিক মোবাইল নম্বর ও কোড দিন।",
    close: "বন্ধ", theme: "লাইট/ডার্ক", language: "ভাষা", plan: "প্রিভিউ — Premium চালু না থাকায় রোগীরা সাধারণ প্রোফাইল দেখছেন।",
  },
  en: {
    home: "Home", about: "About", services: "Services", chambers: "Chambers & Hours", faq: "FAQ",
    book: "Book Serial", bookNow: "Book a serial online", whatsapp: "WhatsApp", call: "Call",
    bmdc: "BMDC Reg. No", verified: "BMDC Verified", hotline: "Serial Hotline",
    open: "Chamber open today • Online serials available", full: "Today's online serials are full • Book for another day", closed: "Advance serials available online",
    exp: "Years of experience", pts: "Patients seen (DoctorsVilla)", chs: "Chambers",
    servicesEyebrow: "Specialized care", aboutEyebrow: "About the doctor", quals: "Education & qualifications", experience: "Experience", years: "years",
    chambersEyebrow: "Where to visit", feeNew: "New patient", feeFu: "Follow-up", off: "Closed", map: "View on map",
    bookEyebrow: "Online serial", bookTitle: "Book your chamber serial today", bookText: "Get your serial number instantly, and track live on your phone when your turn is coming.",
    name: "Patient name", phone: "Mobile number (01XXXXXXXXX)", chamber: "Chamber", date: "Date", noDays: "No online serials free in the next 14 days — please call the hotline",
    submit: "Confirm serial", sending: "Booking…",
    faqEyebrow: "FAQ", faqTitle: "Questions patients often ask",
    fChambers: "Chambers", fLinks: "Quick links", fContact: "Contact & serial", emergency: "Emergency:",
    rights: "All rights reserved.", made: "Made with DoctorsVilla", menu: "Menu",
    draft: "Preview — not published yet. Only you can see this.",
    queue: "Live queue", videos: "Videos", blog: "Health tips", videosEyebrow: "Watch & learn", videosTitle: "Health videos", blogEyebrow: "Read & learn", blogTitle: "Health tips & articles", readMore: "Read more", play: "Play video", queueEyebrow: "Today's queue", queueTitle: "Which serial is running, how many are waiting",
    nowServing: "Now serving", qTotal: "Today total", qWaiting: "Waiting", qDone: "Seen", perPt: "min/patient (avg)",
    notStarted: "Not started yet", closedToday: "Closed today", noSerial: "No serials yet today",
    lgWait: "Waiting", lgNow: "Now", lgDone: "Seen", lgAbsent: "Absent", updated: "Updated",
    findTitle: "Find my serial", findText: "Enter your mobile number and serial code (sent by SMS, e.g. RAJ-1102-07).",
    findPhone: "Mobile number", findCode: "Serial code", findBtn: "Find", finding: "Searching…",
    findNo: "No serial found for this number and code.", findFmt: "Enter a valid mobile number and code.",
    close: "Close", theme: "Light/Dark", language: "Language", plan: "Preview — Premium is off, patients see the basic profile.",
  },
};

/** "MBBS, FCPS (Medicine), MD" → "FCPS • MD" — হেডারের ছোট চিপের জন্য */
function shortDegrees(deg: string) {
  const parts = deg.split(/[,،;]/).map((p) => p.replace(/\(.*?\)/g, "").trim()).filter(Boolean);
  const top = parts.filter((p) => !/^(MBBS|এমবিবিএস|BDS|বিডিএস)$/i.test(p));
  return (top.length ? top : parts).slice(-2).join(" • ");
}

/** ভিডিও কার্ড — প্রথমে শুধু ছবি, চাপলে তবেই ভিডিও লোড (সাইট ধীর হয় না) */
function VideoCard({ url, title, t }: { url: string; title: string; t: typeof UI.bn }) {
  const [on, setOn] = useState(false);
  const [thumbOk, setThumbOk] = useState(false);
  const v = parseVideo(url);
  if (!v) return null;
  return (
    <article className="ws-vid">
      <div className={`ws-vid-box ${v.kind}`}>
        {on ? <iframe src={v.embed} title={title || v.label} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />
          : (
            <button type="button" className="ws-vid-play" onClick={() => setOn(true)} aria-label={`${t.play}: ${title || v.label}`}>
              {v.thumb && <img src={v.thumb} alt="" loading="lazy" className={thumbOk ? "ok" : ""} ref={(el) => { if (el?.complete && el.naturalWidth > 0) setThumbOk(true); }} onLoad={() => setThumbOk(true)} />}
              <span className="ws-vid-btn"><svg viewBox="0 0 24 24" width="30" height="30" aria-hidden><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg></span>
              <span className="ws-vid-src">{v.label}</span>
            </button>
          )}
      </div>
      {title && <h3>{title}</h3>}
    </article>
  );
}

function BookingForm({ chambers, t, lang, live }: { chambers: WsChamber[]; t: typeof UI.bn; lang: Lang; live?: boolean }) {
  const [state, action, pending] = useActionState(bookOnline, undefined);
  const [cid, setCid] = useState(chambers[0]?.id ?? "");
  const ch = chambers.find((c) => c.id === cid) ?? chambers[0];
  return (
    <form className="ws-form" onSubmit={live ? (e) => e.preventDefault() : keepValues(action)}>
      <div className="ws-form-grid">
        <label><span className="sr">{t.name}</span><input name="name" required minLength={2} maxLength={60} placeholder={t.name} autoComplete="name" /></label>
        <label><span className="sr">{t.phone}</span><input name="phone" required inputMode="tel" maxLength={16} placeholder={t.phone} autoComplete="tel" /></label>
        <label><span className="sr">{t.chamber}</span>
          <select name="chamberId" value={cid} onChange={(e) => setCid(e.target.value)} aria-label={t.chamber}>
            {chambers.map((c) => <option key={c.id} value={c.id}>{c.name}, {c.city}</option>)}
          </select>
        </label>
        <label><span className="sr">{t.date}</span>
          <select name="date" key={ch?.id} required aria-label={t.date} disabled={!ch?.days.length}>
            {ch?.days.length ? ch.days.map((d) => <option key={d.date} value={d.date}>{lang === "bn" ? d.bn : d.en}</option>) : <option value="">{t.noDays}</option>}
          </select>
        </label>
      </div>
      {state?.error && <p className="ws-form-err" role="alert">⚠ {state.error}</p>}
      <button className="ws-btn ws-btn-a ws-block" disabled={pending || !ch?.days.length}>
        <Icon name="check" size={18} stroke={2.6} />{pending ? t.sending : t.submit}
      </button>
    </form>
  );
}

type QChamber = { id: string; name: string; city: string; open: boolean; start: string | null; current: number | null; total: number; waiting: number; done: number; avg: number; list: { n: number; s: string }[] };

/** আজকের লাইভ সিরিয়াল — ৩০ সেকেন্ড পরপর নিজে থেকে আপডেট; শুধু নম্বর, কারো নাম নয় */
function LiveQueue({ slug, t, lang, live }: { slug: string; t: typeof UI.bn; lang: Lang; live?: boolean }) {
  const [data, setData] = useState<{ chambers: QChamber[]; at: string } | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let stop = false;
    const load = () => fetch(`/api/site/${slug}/queue`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (!stop && j) setData(j); }).catch(() => {});
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, 30_000);
    return () => { stop = true; clearInterval(id); };
  }, [slug]);
  const n = (x: number) => fmt(x, lang);
  async function find(e: React.FormEvent) {
    e.preventDefault();
    if (live) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/site/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, code }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.url) { location.href = j.url; return; }
      setMsg(r.status === 400 ? t.findFmt : t.findNo);
    } catch { setMsg(t.findNo); }
    setBusy(false);
  }
  return (
    <div className="ws-q">
      <div className="ws-q-list">
        {!data && <div className="ws-q-card ws-q-skel" aria-busy="true" />}
        {data?.chambers.map((c) => (
          <article key={c.id} className="ws-q-card">
            <header className="ws-q-h">
              <span className="col"><b>{c.name}</b><span className="ws-mut">{c.city}</span></span>
              <span className={`ws-q-live${c.current ? " on" : ""}`}><i />{c.current ? t.lgNow : c.open ? t.notStarted : t.closedToday}</span>
            </header>
            <div className="ws-q-main">
              <div className="ws-q-now">
                <span>{t.nowServing}</span>
                <b>{c.current ? n(c.current) : "—"}</b>
              </div>
              <div className="ws-q-stats">
                <span><b>{n(c.total)}</b>{t.qTotal}</span>
                <span><b>{n(c.waiting)}</b>{t.qWaiting}</span>
                <span><b>{n(c.done)}</b>{t.qDone}</span>
                <span><b>~{n(c.avg)}</b>{t.perPt}</span>
              </div>
            </div>
            {c.list.length > 0 ? (
              <>
                <div className="ws-q-chips" aria-label={t.queue}>
                  {c.list.map((x) => <span key={x.n} className={`ws-qc ${x.s.toLowerCase()}`} title={x.s}>{n(x.n)}</span>)}
                </div>
                <div className="ws-q-legend">
                  <span><i className="waiting" />{t.lgWait}</span><span><i className="in_progress" />{t.lgNow}</span>
                  <span><i className="done" />{t.lgDone}</span><span><i className="absent" />{t.lgAbsent}</span>
                </div>
              </>
            ) : <p className="ws-mut">{c.open ? t.noSerial : t.closedToday}</p>}
          </article>
        ))}
        {data && <span className="ws-q-at">{t.updated}: {lang === "bn" ? D(data.at) : data.at}</span>}
      </div>
      <form className="ws-q-find" onSubmit={find}>
        <span className="ws-q-find-ic"><Icon name="search" size={22} /></span>
        <h3>{t.findTitle}</h3>
        <p>{t.findText}</p>
        <label><span className="sr">{t.findPhone}</span><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={16} placeholder={t.findPhone} required autoComplete="tel" /></label>
        <label><span className="sr">{t.findCode}</span><input value={code} onChange={(e) => setCode(e.target.value)} maxLength={16} placeholder={`${t.findCode} — RAJ-1102-07`} required style={{ textTransform: "uppercase" }} /></label>
        {msg && <p className="ws-form-err" role="alert">⚠ {msg}</p>}
        <button className="ws-btn ws-btn-p ws-block" disabled={busy}><Icon name="search" size={18} />{busy ? t.finding : t.findBtn}</button>
      </form>
    </div>
  );
}

export function DoctorWebsite({ d, live, forceLang }: { d: WsData; live?: boolean; forceLang?: Lang }) {
  const [lang0, setLang] = useState<Lang>("bn");
  const lang: Lang = forceLang ?? lang0;
  const [menu, setMenu] = useState(false);
  // মেনু খোলা থাকলে পেছনের পেজ স্ক্রল হবে না, Esc চাপলে বন্ধ
  useEffect(() => {
    if (!menu) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", esc); };
  }, [menu]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ws_lang");
      if (d.english && saved === "en") setLang("en");
    } catch { /* প্রাইভেট উইন্ডো */ }
  }, [d.english]);
  useEffect(() => { if (!live) document.documentElement.lang = lang; }, [lang, live]);
  const pick = (l: Lang) => {
    setLang(l);
    try { localStorage.setItem("ws_lang", l); } catch { /* ignore */ }
  };

  const c = d.content;
  const t = UI[lang];
  /** ইংরেজি ঘর খালি থাকলে বাংলাটাই */
  const tx = <K extends keyof SiteText>(k: K): SiteText[K] => {
    const e = c.en[k];
    return lang === "en" && e && (typeof e !== "string" || e.trim()) ? e : c.bn[k];
  };
  const name = lang === "en" && c.en.name?.trim() ? c.en.name : d.name;
  const degrees = lang === "en" && c.en.degrees?.trim() ? c.en.degrees : d.degrees;
  const services = c.bn.services.map((s, i) => ({
    icon: s.icon as keyof typeof ICON,
    title: (lang === "en" && c.en.services[i]?.title) || s.title,
    desc: (lang === "en" && c.en.services[i]?.desc) || s.desc,
  }));
  const faqs = c.bn.faqs.map((f, i) => ({ q: (lang === "en" && c.en.faqs[i]?.q) || f.q, a: (lang === "en" && c.en.faqs[i]?.a) || f.a }));
  const videos = (c.videos ?? []).filter((v) => parseVideo(v.url)).map((v) => ({ url: v.url, title: (lang === "en" && v.titleEn) || v.title }));
  const posts = (c.posts ?? []).filter((p) => p.title.trim()).map((p) => {
    const title = (lang === "en" && p.titleEn) || p.title, body = (lang === "en" && p.bodyEn) || p.body;
    return { id: p.id, date: p.date, cover: p.cover, title, excerpt: body.replace(/\s+/g, " ").slice(0, 130) + (body.length > 130 ? "…" : "") };
  });
  const S = c.sections;
  const hasCh = d.chambers.length > 0;
  const show = {
    services: S.services && services.length > 0,
    about: S.about && Boolean(tx("about").trim()),
    chambers: S.chambers && hasCh,
    booking: S.booking && hasCh,
    faq: S.faq && faqs.length > 0,
    emergency: S.emergency && Boolean(tx("emergency").trim()),
    queue: S.queue !== false && hasCh,
    videos: S.videos !== false && videos.length > 0,
    blog: S.blog !== false && posts.length > 0,
  };
  const tel = c.hotline ? `tel:${c.hotline.replace(/[^\d+]/g, "")}` : null;
  const wa = c.whatsapp ? `https://wa.me/${c.whatsapp.startsWith("0") ? `88${c.whatsapp}` : c.whatsapp}` : null;
  const bookHref = show.booking ? "#booking" : hasCh ? `/dr/${d.slug}/book` : tel;
  const num = (s: string) => (lang === "bn" ? D(s) : s);
  const initials = name.replace(/^(অধ্যাপক|সহযোগী অধ্যাপক|ডা\.?|ডাঃ|Dr\.?|Prof\.?)\s*/g, "").trim().slice(0, lang === "en" ? 1 : 2);

  const NAV_LABEL: Partial<Record<SiteBlock, string>> = { about: t.about, services: t.services, chambers: t.chambers, queue: t.queue, videos: t.videos, blog: t.blog, faq: t.faq };
  const nav = [
    { id: "top", label: t.home, on: true },
    ...c.order.filter((k) => NAV_LABEL[k]).map((k) => ({ id: k, label: NAV_LABEL[k]!, on: show[k] })),
  ].filter((n) => n.on);

  const NAV_IC: Record<string, keyof typeof ICON> = { top: "layout", about: "user", services: "steth", chambers: "pin", queue: "pulse", faq: "help", videos: "youtube", blog: "edit" };
  const stats = [
    c.stats.experience && d.stats.experience ? { v: `${fmt(d.stats.experience, lang)}+`, l: t.exp } : null,
    c.stats.patients && d.stats.patients >= 10 ? { v: `${fmt(d.stats.patients >= 100 ? Math.floor(d.stats.patients / 10) * 10 : d.stats.patients, lang)}+`, l: t.pts } : null,
    c.stats.chambers && d.stats.chambers ? { v: fmt(d.stats.chambers, lang), l: t.chs } : null,
  ].filter(Boolean) as { v: string; l: string }[];

  // ---- সাজানো যায় এমন অংশ (ডাক্তার যে ক্রমে রেখেছেন) ----
  const sec = (i: number) => `ws-sec${i % 2 === 1 ? " ws-sec-alt" : ""}`;
  const BLOCK: Record<SiteBlock, (i: number) => React.ReactNode> = {
    services: (i) => (
          <section className={sec(i)} id="services">
            <div className="ws-wrap">
              <div className="ws-sec-h">
                <span className="ws-eyebrow">{t.servicesEyebrow}</span>
                <h2>{tx("servicesTitle") || t.services}</h2>
              </div>
              <div className="ws-cards">
                {services.map((s, i) => (
                  <article key={i} className="ws-card">
                    <span className="ws-card-ic"><Icon name={s.icon} size={22} /></span>
                    <h3>{s.title}</h3>
                    {s.desc && <p>{s.desc}</p>}
                  </article>
                ))}
              </div>
            </div>
          </section>
    ),
    about: (i) => (
          <section className={sec(i)} id="about">
            <div className="ws-wrap ws-about">
              <div>
                <span className="ws-eyebrow">{t.aboutEyebrow}</span>
                <h2>{name}</h2>
                <div className="ws-about-txt">{tx("about").split(/\n+/).map((p, i) => <p key={i}>{p}</p>)}</div>
              </div>
              <aside className="ws-quals">
                <h3><Icon name="award" size={20} />{t.quals}</h3>
                <ul>{degrees.split(/[,،;]/).map((x) => x.trim()).filter(Boolean).map((x) => <li key={x}><Icon name="check" size={16} stroke={2.6} />{x}</li>)}</ul>
                {d.stats.experience ? <p><b>{t.experience}:</b> {fmt(d.stats.experience, lang)}+ {t.years}</p> : null}
                <p><b>{t.bmdc}:</b> {num(d.bmdcNo)}{d.verified ? ` ✓` : ""}</p>
              </aside>
            </div>
          </section>
    ),
    chambers: (i) => (
          <section className={sec(i)} id="chambers">
            <div className="ws-wrap">
              <div className="ws-sec-h">
                <span className="ws-eyebrow">{t.chambersEyebrow}</span>
                <h2>{t.chambers}</h2>
              </div>
              <div className="ws-chs">
                {d.chambers.map((ch, i) => (
                  <article key={ch.id} className="ws-ch">
                    <div className="ws-ch-h">
                      <span className="ws-ch-n">{fmt(i + 1, lang)}</span>
                      <span className="col">
                        <h3>{ch.name}</h3>
                        <span className="ws-mut"><Icon name="pin" size={15} />{ch.address}, {ch.city}</span>
                      </span>
                    </div>
                    <ul className="ws-ch-time">
                      {(lang === "bn" ? ch.schedBn : ch.schedEn).map((l) => <li key={l}><Icon name="clock" size={15} />{l}</li>)}
                      {(lang === "bn" ? ch.offBn : ch.offEn) && <li className="ws-off"><Icon name="x" size={15} />{lang === "bn" ? ch.offBn : ch.offEn} {t.off}</li>}
                    </ul>
                    <div className="ws-fees">
                      <span><small>{t.feeNew}</small><b>৳{fmt(ch.feeNew, lang)}</b></span>
                      <span><small>{t.feeFu}</small><b>৳{fmt(ch.feeFollowUp, lang)}</b></span>
                    </div>
                    <span className={`ws-today ${ch.todayCls}`}>{lang === "bn" ? ch.todayBn : ch.todayEn}</span>
                    <div className="ws-ch-act">
                      <a className="ws-btn ws-btn-p ws-btn-sm" href={show.booking ? "#booking" : `/dr/${d.slug}/book?chamber=${ch.id}`}>{t.book}</a>
                      <a className="ws-btn ws-btn-o ws-btn-sm" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${ch.name}, ${ch.address}, ${ch.city}`)}`}><Icon name="pin" size={16} />{t.map}</a>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
    ),
    queue: (i) => (
          <section className={sec(i)} id="queue">
            <div className="ws-wrap">
              <div className="ws-sec-h">
                <span className="ws-eyebrow">{t.queueEyebrow}</span>
                <h2>{t.queueTitle}</h2>
              </div>
              <LiveQueue slug={d.slug} t={t} lang={lang} live={live} />
            </div>
          </section>
    ),
    booking: (i) => (
          <section className={sec(i)} id="booking">
            <div className="ws-wrap">
              <div className="ws-book">
                <div className="ws-book-txt">
                  <span className="ws-eyebrow light">{t.bookEyebrow}</span>
                  <h2>{t.bookTitle}</h2>
                  <p>{t.bookText}</p>
                  {c.hotline && <a href={tel!} className="ws-book-hot"><Icon name="phone" size={18} />{t.hotline}: {num(c.hotline)}</a>}
                </div>
                <BookingForm chambers={d.chambers} t={t} lang={lang} live={live} />
              </div>
            </div>
          </section>
    ),
    faq: (i) => (
          <section className={sec(i)} id="faq">
            <div className="ws-wrap ws-faq-wrap">
              <div className="ws-sec-h">
                <span className="ws-eyebrow">{t.faqEyebrow}</span>
                <h2>{t.faqTitle}</h2>
              </div>
              <div className="ws-faq">
                {faqs.map((f, i) => (
                  <details key={i} open={i === 0}>
                    <summary>{f.q}<Icon name="down" size={20} /></summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
    ),
    videos: (i) => (
      <section className={sec(i)} id="videos">
        <div className="ws-wrap">
          <div className="ws-sec-h">
            <span className="ws-eyebrow">{t.videosEyebrow}</span>
            <h2>{t.videosTitle}</h2>
          </div>
          <div className="ws-vids">
            {videos.map((v, j) => <VideoCard key={v.url + j} url={v.url} title={v.title} t={t} />)}
          </div>
        </div>
      </section>
    ),
    blog: (i) => (
      <section className={sec(i)} id="blog">
        <div className="ws-wrap">
          <div className="ws-sec-h">
            <span className="ws-eyebrow">{t.blogEyebrow}</span>
            <h2>{t.blogTitle}</h2>
          </div>
          <div className="ws-posts">
            {posts.map((p) => (
              <a key={p.id} href={`/dr/${d.slug}/blog/${p.id}`} className="ws-post">
                <span className="ws-post-img">{p.cover ? <img src={`/dr/${d.slug}/asset/post-${p.id}?v=${p.cover}`} alt="" loading="lazy" /> : <Icon name="steth" size={34} />}</span>
                <span className="ws-post-b">
                  <small>{postDate(p.date, lang)}</small>
                  <b>{p.title}</b>
                  <span>{p.excerpt}</span>
                  <em>{t.readMore} →</em>
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>
    ),
  };
  const visible = c.order.filter((k) => show[k]);

  const LangSwitch = d.english ? (
    <div className="ws-lang" role="group" aria-label="Language">
      <button type="button" aria-pressed={lang === "en"} className={lang === "en" ? "on" : ""} onClick={() => pick("en")}>EN</button>
      <button type="button" aria-pressed={lang === "bn"} className={lang === "bn" ? "on" : ""} onClick={() => pick("bn")}>বাংলা</button>
    </div>
  ) : null;

  return (
    <div className={`ws th-${c.theme}${lang === "en" ? " is-en" : ""}`} id="top"
      onClickCapture={live ? (e) => {
        const a = (e.target as HTMLElement).closest("a");
        if (a && !a.getAttribute("href")?.startsWith("#")) e.preventDefault();
      } : undefined}>
      {d.preview && <div className="ws-preview">{d.preview === "draft" ? t.draft : t.plan}</div>}

      {/* ---------- আর্টবোর্ড ১ · হেডার ---------- */}
      {S.topbar && (
        <div className="ws-topbar">
          <div className="ws-wrap ws-topbar-in">
            <span className="ws-tb-item"><Icon name="shield" size={15} />{t.bmdc}: {num(d.bmdcNo)}{d.verified && <b className="ws-tb-ok"> ✓ {t.verified}</b>}</span>
            {tx("topNote") && <span className="ws-tb-item ws-tb-note"><Icon name="award" size={15} />{tx("topNote")}</span>}
            {c.hotline && <a className="ws-tb-hot" href={tel!}><Icon name="phone" size={15} />{t.hotline}: {num(c.hotline)}</a>}
          </div>
        </div>
      )}
      <header className="ws-nav">
        <div className="ws-wrap ws-nav-in">
          <a href="#top" className="ws-brand">
            <span className="ws-logo"><Icon name="heart" size={24} color="#fff" /></span>
            <span className="ws-brand-t">
              <span className="ws-brand-n">{name}{shortDegrees(degrees) && <em className="ws-chip">{shortDegrees(degrees)}</em>}</span>
              <span className="ws-brand-s">{tx("designation")}</span>
            </span>
          </a>
          <nav className={`ws-links${menu ? " open" : ""}`} aria-label={t.menu}>
            {nav.map((n, i) => <a key={n.id} href={`#${n.id}`} className={i === 0 ? "on" : ""} onClick={() => setMenu(false)}>{n.label}</a>)}
          </nav>
          <div className="ws-nav-r">
            {LangSwitch}
            {!live && <ThemeToggle className="ws-mode" label={false} />}
            {bookHref && <a href={bookHref} className="ws-btn ws-btn-p ws-nav-cta"><Icon name="calendar" size={18} />{show.booking || hasCh ? t.book : t.call}</a>}
            <button type="button" className="ws-burger" aria-expanded={menu} aria-controls="ws-drawer" aria-label={t.menu} onClick={() => setMenu(true)}>
              <Icon name="menu" size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* মোবাইল/ট্যাবলেটের মেনু — ডান দিক থেকে আসা প্যানেল */}
      <div className={`ws-drawer-bg${menu ? " open" : ""}`} onClick={() => setMenu(false)} aria-hidden="true" />
      <aside id="ws-drawer" className={`ws-drawer${menu ? " open" : ""}`} aria-label={t.menu} aria-hidden={!menu} inert={!menu}>
        <div className="ws-drawer-h">
          <span className="ws-logo sm2"><Icon name="heart" size={20} color="#fff" /></span>
          <span className="col grow"><b>{name}</b><span className="ws-mut">{tx("designation")}</span></span>
          <button type="button" className="ws-burger show" onClick={() => setMenu(false)} aria-label={t.close}><Icon name="x" size={22} /></button>
        </div>
        <nav className="ws-drawer-nav">
          {nav.map((n) => (
            <a key={n.id} href={`#${n.id}`} onClick={() => setMenu(false)}>
              <span className="ws-dn-ic"><Icon name={NAV_IC[n.id] ?? "chevron"} size={19} /></span>
              <span className="grow">{n.label}</span>
              <Icon name="chevron" size={18} />
            </a>
          ))}
        </nav>
        <div className="ws-drawer-opts">
          {d.english && <div className="ws-drawer-row"><span>{t.language}</span>{LangSwitch}</div>}
          {!live && <div className="ws-drawer-row"><span>{t.theme}</span><ThemeToggle className="ws-mode" label={false} /></div>}
        </div>
        <div className="ws-drawer-cta">
          {bookHref && <a href={bookHref} className="ws-btn ws-btn-p ws-block" onClick={() => setMenu(false)}><Icon name="calendar" size={18} />{hasCh ? t.bookNow : t.call}</a>}
          {tel && <a href={tel} className="ws-btn ws-btn-o ws-block"><Icon name="phone" size={18} />{t.hotline}: {num(c.hotline)}</a>}
        </div>
        <p className="ws-drawer-f"><Icon name="shield" size={14} />{t.bmdc}: {num(d.bmdcNo)}</p>
      </aside>

      <main>
        {/* ---------- আর্টবোর্ড ২ · হিরো ---------- */}
        <section className="ws-hero">
          <div className="ws-wrap ws-hero-in">
            <div className="ws-hero-txt">
              {hasCh && <span className={`ws-pill ${d.openToday}`}><i />{t[d.openToday]}</span>}
              <h1>{tx("heroTitle")}</h1>
              {tx("heroText") && <p className="ws-lead">{tx("heroText")}</p>}
              {S.stats && stats.length > 0 && (
                <div className="ws-stats">
                  {stats.map((s) => <div key={s.l} className="ws-stat"><b>{s.v}</b><span>{s.l}</span></div>)}
                </div>
              )}
              <div className="ws-hero-cta">
                {bookHref && <a href={bookHref} className="ws-btn ws-btn-p"><Icon name="calendar" size={18} />{hasCh ? t.bookNow : t.call}</a>}
                {wa && <a href={wa} target="_blank" rel="noreferrer" className="ws-btn ws-btn-a"><Icon name="chat" size={18} />{t.whatsapp}</a>}
                {!wa && tel && hasCh && <a href={tel} className="ws-btn ws-btn-o"><Icon name="phone" size={18} />{t.call}</a>}
              </div>
            </div>
            <div className="ws-hero-pic">
              <div className="ws-photo">
                {d.photo ? <img src={d.photo} alt={name} /> : <span className="ws-photo-ph">{initials}</span>}
                <div className="ws-photo-cap">
                  {d.verified && <span className="ws-photo-v"><Icon name="check" size={13} stroke={3} />{t.verified}</span>}
                  <b>{name}</b>
                  <span>{tx("designation")}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {visible.map((k, i) => <Fragment key={k}>{BLOCK[k](i)}</Fragment>)}
      </main>

      {/* ---------- আর্টবোর্ড ৩ · ফুটার ---------- */}
      <footer className="ws-foot" id="footer">
        <div className="ws-wrap">
          <div className="ws-foot-grid">
            <div className="ws-foot-col">
              <div className="ws-foot-brand"><span className="ws-logo sm"><Icon name="heart" size={20} color="#fff" /></span><b>{name}</b></div>
              <p>{tx("designation")}</p>
              <p className="ws-foot-a">BMDC Reg. No: {d.bmdcNo}</p>
              {(c.facebook || c.youtube || c.linkedin) && (
                <div className="ws-social">
                  {c.facebook && <a href={c.facebook} target="_blank" rel="noreferrer" aria-label="Facebook"><Icon name="facebook" size={18} /></a>}
                  {c.youtube && <a href={c.youtube} target="_blank" rel="noreferrer" aria-label="YouTube"><Icon name="youtube" size={18} /></a>}
                  {c.linkedin && <a href={c.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn"><Icon name="linkedin" size={18} /></a>}
                </div>
              )}
            </div>
            {hasCh && (
              <div className="ws-foot-col">
                <h4>{t.fChambers}</h4>
                {d.chambers.map((ch, i) => (
                  <div key={ch.id} className="ws-foot-ch">
                    <b>{fmt(i + 1, lang)}. {ch.name}</b>
                    <span>{ch.city}{(lang === "bn" ? ch.schedBn : ch.schedEn)[0] ? ` (${(lang === "bn" ? ch.schedBn : ch.schedEn)[0]})` : ""}</span>
                  </div>
                ))}
              </div>
            )}
            {(nav.length > 1 || show.booking) && (
              <div className="ws-foot-col">
                <h4>{t.fLinks}</h4>
                {nav.slice(1).map((n) => <a key={n.id} href={`#${n.id}`}>{n.label}</a>)}
                {show.booking && <a href="#booking">{t.bookNow}</a>}
              </div>
            )}
            {(c.hotline || hasCh || c.email) && <div className="ws-foot-col">
              <h4>{t.fContact}</h4>
              {c.hotline ? (
                <>
                  <span>{t.hotline}:</span>
                  <a href={tel!} className="ws-foot-hot">{num(c.hotline)}</a>
                </>
              ) : hasCh ? <a href={`/dr/${d.slug}/book`}>{t.bookNow}</a> : null}
              {c.email && <a href={`mailto:${c.email}`} className="ws-foot-a">{c.email}</a>}
            </div>}
          </div>
          {show.emergency && (
            <p className="ws-emerg"><Icon name="alert" size={18} /><span><b>{t.emergency}</b> {tx("emergency")}</span></p>
          )}
          <div className="ws-copy">
            <span>© {num(String(d.year))} {name}{lang === "bn" ? "।" : "."} {t.rights}</span>
            <a href="/">{t.made}</a>
          </div>
        </div>
      </footer>

      {bookHref && (
        <div className="ws-mbar">
          {tel && <a href={tel} className="ws-btn ws-btn-o" aria-label={t.call}><Icon name="phone" size={20} /></a>}
          <a href={bookHref} className="ws-btn ws-btn-p ws-grow"><Icon name="calendar" size={18} />{hasCh ? t.book : t.call}</a>
        </div>
      )}
    </div>
  );
}
