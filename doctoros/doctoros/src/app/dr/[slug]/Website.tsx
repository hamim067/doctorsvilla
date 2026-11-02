"use client";
import { useActionState, useEffect, useState } from "react";
import { bookOnline } from "@/app/dr/actions";
import { Icon, type ICON } from "@/components/Icons";
import { keepValues } from "@/components/keepValues";
import type { SiteContent, SiteText } from "@/db/schema";

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
    draft: "প্রিভিউ — ওয়েবসাইট এখনো প্রকাশ হয়নি। শুধু আপনি দেখছেন।", plan: "প্রিভিউ — Premium চালু না থাকায় রোগীরা সাধারণ প্রোফাইল দেখছেন।",
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
    draft: "Preview — not published yet. Only you can see this.", plan: "Preview — Premium is off, patients see the basic profile.",
  },
};

/** "MBBS, FCPS (Medicine), MD" → "FCPS • MD" — হেডারের ছোট চিপের জন্য */
function shortDegrees(deg: string) {
  const parts = deg.split(/[,،;]/).map((p) => p.replace(/\(.*?\)/g, "").trim()).filter(Boolean);
  const top = parts.filter((p) => !/^(MBBS|এমবিবিএস|BDS|বিডিএস)$/i.test(p));
  return (top.length ? top : parts).slice(-2).join(" • ");
}

function BookingForm({ chambers, t, lang }: { chambers: WsChamber[]; t: typeof UI.bn; lang: Lang }) {
  const [state, action, pending] = useActionState(bookOnline, undefined);
  const [cid, setCid] = useState(chambers[0]?.id ?? "");
  const ch = chambers.find((c) => c.id === cid) ?? chambers[0];
  return (
    <form className="ws-form" onSubmit={keepValues(action)}>
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

export function DoctorWebsite({ d }: { d: WsData }) {
  const [lang, setLang] = useState<Lang>("bn");
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ws_lang");
      if (d.english && saved === "en") setLang("en");
    } catch { /* প্রাইভেট উইন্ডো */ }
  }, [d.english]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
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
  const S = c.sections;
  const hasCh = d.chambers.length > 0;
  const show = {
    services: S.services && services.length > 0,
    about: S.about && Boolean(tx("about").trim()),
    chambers: S.chambers && hasCh,
    booking: S.booking && hasCh,
    faq: S.faq && faqs.length > 0,
    emergency: S.emergency && Boolean(tx("emergency").trim()),
  };
  const tel = c.hotline ? `tel:${c.hotline.replace(/[^\d+]/g, "")}` : null;
  const wa = c.whatsapp ? `https://wa.me/${c.whatsapp.startsWith("0") ? `88${c.whatsapp}` : c.whatsapp}` : null;
  const bookHref = show.booking ? "#booking" : hasCh ? `/dr/${d.slug}/book` : tel;
  const num = (s: string) => (lang === "bn" ? D(s) : s);
  const initials = name.replace(/^(অধ্যাপক|সহযোগী অধ্যাপক|ডা\.?|ডাঃ|Dr\.?|Prof\.?)\s*/g, "").trim().slice(0, lang === "en" ? 1 : 2);

  const nav = [
    { id: "top", label: t.home, on: true },
    { id: "about", label: t.about, on: show.about },
    { id: "services", label: t.services, on: show.services },
    { id: "chambers", label: t.chambers, on: show.chambers },
    { id: "faq", label: t.faq, on: show.faq },
  ].filter((n) => n.on);

  const stats = [
    c.stats.experience && d.stats.experience ? { v: `${fmt(d.stats.experience, lang)}+`, l: t.exp } : null,
    c.stats.patients && d.stats.patients >= 10 ? { v: `${fmt(d.stats.patients >= 100 ? Math.floor(d.stats.patients / 10) * 10 : d.stats.patients, lang)}+`, l: t.pts } : null,
    c.stats.chambers && d.stats.chambers ? { v: fmt(d.stats.chambers, lang), l: t.chs } : null,
  ].filter(Boolean) as { v: string; l: string }[];

  const LangSwitch = d.english ? (
    <div className="ws-lang" role="group" aria-label="Language">
      <button type="button" aria-pressed={lang === "en"} className={lang === "en" ? "on" : ""} onClick={() => pick("en")}>EN</button>
      <button type="button" aria-pressed={lang === "bn"} className={lang === "bn" ? "on" : ""} onClick={() => pick("bn")}>বাংলা</button>
    </div>
  ) : null;

  return (
    <div className={`ws th-${c.theme}${lang === "en" ? " is-en" : ""}`} id="top">
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
            {bookHref && <a href={bookHref} className="ws-btn ws-btn-p ws-nav-cta"><Icon name="calendar" size={18} />{show.booking || hasCh ? t.book : t.call}</a>}
            {nav.length > 1 && (
              <button type="button" className="ws-burger" aria-expanded={menu} aria-label={t.menu} onClick={() => setMenu(!menu)}>
                <Icon name={menu ? "x" : "menu"} size={22} />
              </button>
            )}
          </div>
        </div>
      </header>

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

        {show.services && (
          <section className="ws-sec" id="services">
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
        )}

        {show.about && (
          <section className="ws-sec ws-sec-alt" id="about">
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
        )}

        {show.chambers && (
          <section className="ws-sec" id="chambers">
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
        )}

        {show.booking && (
          <section className="ws-sec" id="booking">
            <div className="ws-wrap">
              <div className="ws-book">
                <div className="ws-book-txt">
                  <span className="ws-eyebrow light">{t.bookEyebrow}</span>
                  <h2>{t.bookTitle}</h2>
                  <p>{t.bookText}</p>
                  {c.hotline && <a href={tel!} className="ws-book-hot"><Icon name="phone" size={18} />{t.hotline}: {num(c.hotline)}</a>}
                </div>
                <BookingForm chambers={d.chambers} t={t} lang={lang} />
              </div>
            </div>
          </section>
        )}

        {show.faq && (
          <section className="ws-sec ws-sec-alt" id="faq">
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
        )}
      </main>

      {/* ---------- আর্টবোর্ড ৩ · ফুটার ---------- */}
      <footer className="ws-foot">
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
