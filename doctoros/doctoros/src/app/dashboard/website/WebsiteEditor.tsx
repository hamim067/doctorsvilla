"use client";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Icon, type ICON } from "@/components/Icons";
import type { SiteContent, SiteSections, SiteText } from "@/db/schema";
import { saveSite } from "./actions";

type Lang = "bn" | "en";
type Doc = { name: string; degrees: string; bmdcNo: string; slug: string; experienceYears: number | null };

const ICONS: (keyof typeof ICON)[] = ["heart", "pulse", "steth", "brain", "bone", "tooth", "eye", "ear", "child", "gyn", "skin", "drop", "pill", "syringe", "micro", "shield"];
const THEMES: { id: SiteContent["theme"]; label: string; a: string; b: string }[] = [
  { id: "navy", label: "নেভি ও টিল", a: "#123B65", b: "#20A89E" },
  { id: "green", label: "সবুজ", a: "#0F4D43", b: "#22A386" },
  { id: "plum", label: "বেগুনি", a: "#43306B", b: "#2BA39A" },
];

function Switch({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`we-switch${on ? " on" : ""}`} onClick={() => set(!on)}>
      <span />
    </button>
  );
}

function Step({ n, title, hint, on, set, children }: {
  n: number; title: string; hint: string; on?: boolean; set?: (v: boolean) => void; children: React.ReactNode;
}) {
  const optional = on !== undefined && set;
  return (
    <section className={`we-step${optional && !on ? " off" : ""}`}>
      <header className="we-step-h">
        <span className="we-num">{n.toLocaleString("bn-BD")}</span>
        <span className="col grow" style={{ gap: 2 }}>
          <h2>{title}</h2>
          <span className="we-hint">{hint}</span>
        </span>
        {optional && (
          <label className="we-show">
            <span>{on ? "দেখাবে" : "লুকানো"}</span>
            <Switch on={on} set={set} label={`${title} দেখাবে`} />
          </label>
        )}
      </header>
      {optional && !on ? <p className="we-offnote">এই অংশ ওয়েবসাইটে দেখাবে না। চালু করতে ডানের সুইচ চাপুন।</p> : <div className="we-body">{children}</div>}
    </section>
  );
}

/** ছবি ব্রাউজারেই ছোট করা (সর্বোচ্চ ৭২০px, JPEG) — সার্ভারে ভারী ফাইল যায় না */
async function shrink(file: File): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = URL.createObjectURL(file);
  });
  const scale = Math.min(1, 720 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  for (const q of [0.84, 0.72, 0.6, 0.5]) {
    const d = c.toDataURL("image/jpeg", q);
    if (d.length < 440_000) return d;
  }
  throw new Error("big");
}

export function WebsiteEditor({ initial, published: pub0, photo: photo0, premium, offer, doctor, chambers, link }: {
  initial: SiteContent; published: boolean; photo: string | null; premium: boolean; offer: string | null;
  doctor: Doc; chambers: { id: string; name: string; city: string }[]; link: string;
}) {
  const [c, setC] = useState(initial);
  const [lang, setLang] = useState<Lang>("bn");
  const [published, setPublished] = useState(pub0);
  const [photo, setPhoto] = useState(photo0);
  const [photoOut, setPhotoOut] = useState("keep");
  const [photoErr, setPhotoErr] = useState("");
  const [dirty, setDirty] = useState(false);
  const [state, action, pending] = useActionState(saveSite, undefined);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.at) { setPhotoOut("keep"); setDirty(false); }
  }, [state?.at]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const up = (f: (x: SiteContent) => SiteContent) => { setC(f); setDirty(true); };
  const sec = (k: keyof SiteSections) => ({ on: c.sections[k], set: (v: boolean) => up((x) => ({ ...x, sections: { ...x.sections, [k]: v } })) });
  const T = c[lang];
  const B = c.bn;
  const setT = <K extends keyof SiteText>(k: K, v: SiteText[K]) => up((x) => ({ ...x, [lang]: { ...x[lang], [k]: v } }));
  const setRoot = (k: "hotline" | "whatsapp" | "email" | "facebook" | "youtube" | "linkedin", v: string) => up((x) => ({ ...x, [k]: v }));
  const en = lang === "en";
  /** ইংরেজি মোডে ঘরের নিচে বাংলাটা দেখায়, যেন অনুবাদ সহজ হয় */
  const ref = (v: string) => (en && v ? <span className="we-ref">বাংলায়: {v}</span> : null);

  const txt = (k: "designation" | "topNote" | "heroTitle" | "heroText" | "about" | "servicesTitle" | "emergency", label: string, ph: string, rows = 0, max = 200) => (
    <label className="field">
      {label}
      {rows ? (
        <textarea className="input" rows={rows} maxLength={max} value={T[k]} placeholder={en ? B[k] || ph : ph} onChange={(e) => setT(k, e.target.value)} />
      ) : (
        <input className="input" maxLength={max} value={T[k]} placeholder={en ? B[k] || ph : ph} onChange={(e) => setT(k, e.target.value)} />
      )}
      {ref(B[k])}
    </label>
  );

  // সেবা ও প্রশ্নোত্তর: তালিকার গঠন (যোগ/মোছা/ক্রম) বাংলায়, ইংরেজিতে শুধু অনুবাদ
  const moveIn = <X,>(arr: X[], i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return arr;
    const a = [...arr];
    [a[i], a[j]] = [a[j], a[i]];
    return a;
  };
  const services = (fn: (s: SiteText["services"]) => SiteText["services"]) =>
    up((x) => ({ ...x, bn: { ...x.bn, services: fn(x.bn.services) }, en: { ...x.en, services: fn(x.bn.services.map((s, i) => ({ ...s, title: x.en.services[i]?.title ?? "", desc: x.en.services[i]?.desc ?? "" }))) } }));
  const svcField = (i: number, k: "title" | "desc", v: string) =>
    up((x) => {
      const list = x.bn.services.map((s, j) => (lang === "bn" ? s : { ...s, title: x.en.services[j]?.title ?? "", desc: x.en.services[j]?.desc ?? "" }));
      list[i] = { ...list[i], [k]: v };
      return { ...x, [lang]: { ...x[lang], services: list } };
    });
  const faqs = (fn: (s: SiteText["faqs"]) => SiteText["faqs"]) =>
    up((x) => ({ ...x, bn: { ...x.bn, faqs: fn(x.bn.faqs) }, en: { ...x.en, faqs: fn(x.bn.faqs.map((_, i) => ({ q: x.en.faqs[i]?.q ?? "", a: x.en.faqs[i]?.a ?? "" }))) } }));
  const faqField = (i: number, k: "q" | "a", v: string) =>
    up((x) => {
      const list = x.bn.faqs.map((f, j) => (lang === "bn" ? f : { q: x.en.faqs[j]?.q ?? "", a: x.en.faqs[j]?.a ?? "" }));
      list[i] = { ...list[i], [k]: v };
      return { ...x, [lang]: { ...x[lang], faqs: list } };
    });

  async function pickPhoto(f: File | undefined) {
    if (!f) return;
    setPhotoErr("");
    if (!f.type.startsWith("image/")) { setPhotoErr("শুধু ছবি (JPG/PNG) দিন"); return; }
    try {
      const d = await shrink(f);
      setPhoto(d); setPhotoOut(d); setDirty(true);
    } catch {
      setPhotoErr("ছবিটা খোলা যায়নি, অন্য ছবি দিন");
    }
  }

  return (
    <form action={action} className="we">
      <input type="hidden" name="content" value={JSON.stringify(c)} />
      <input type="hidden" name="photo" value={photoOut} />
      <input type="hidden" name="published" value={published ? "1" : "0"} />

      <div className="we-head">
        <div className="col" style={{ gap: 4 }}>
          <h1>আমার ওয়েবসাইট</h1>
          <span className="we-hint">ধাপে ধাপে ঘরগুলো পূরণ করুন — ডিজাইন আপনাআপনি সুন্দর হয়ে যাবে। চেম্বার, সময় আর ফি নেওয়া হয় <Link href="/dashboard/chambers">চেম্বার সেটিং</Link> থেকে।</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <a className="btn" href={`/dr/${doctor.slug}?preview=1`} target="_blank" rel="noreferrer"><Icon name="eye" size={18} />প্রিভিউ</a>
        </div>
      </div>

      {offer && <p className="we-offer"><Icon name="award" size={18} />{offer} — এই সময়ে যোগ দেওয়া ডাক্তাররা পরেও বিশেষ সুবিধা পাবেন।</p>}
      {!premium && <p className="alert alert-error">আপনার Premium চালু নেই। লেখা সেভ করতে পারবেন, কিন্তু প্রকাশ করতে Premium লাগবে।</p>}

      <div className="we-publish">
        <span className="we-pub-ic" data-on={published}><Icon name="globe" size={22} /></span>
        <span className="col grow" style={{ gap: 2 }}>
          <b>{published ? "ওয়েবসাইট প্রকাশিত" : "ওয়েবসাইট এখনো প্রকাশ হয়নি"}</b>
          <span className="we-hint">{published ? <>রোগীরা দেখবেন: <a href={`/dr/${doctor.slug}`} target="_blank" rel="noreferrer">{link}</a></> : "প্রকাশ না করা পর্যন্ত রোগীরা আগের সাধারণ প্রোফাইল দেখবেন।"}</span>
        </span>
        <Switch on={published} set={(v) => { setPublished(v); setDirty(true); }} label="ওয়েবসাইট প্রকাশ" />
      </div>

      <div className="we-lang" role="tablist" aria-label="লেখার ভাষা">
        <span className="we-hint">লেখার ভাষা:</span>
        <button type="button" role="tab" aria-selected={!en} className={!en ? "on" : ""} onClick={() => setLang("bn")}>বাংলা</button>
        <button type="button" role="tab" aria-selected={en} className={en ? "on" : ""} onClick={() => setLang("en")}>English (ঐচ্ছিক)</button>
      </div>
      {en && <p className="we-note">ইংরেজি ঐচ্ছিক। অন্তত <b>পদবি</b> আর <b>মূল শিরোনাম</b> ইংরেজিতে লিখলে ওয়েবসাইটে EN | বাংলা বোতাম দেখাবে। খালি ঘরে বাংলাটাই দেখাবে।</p>}

      <Step n={1} title="হেডার — একদম উপরের অংশ" hint="নাম, ডিগ্রি, BMDC আর সিরিয়াল হটলাইন">
        <div className="we-profile">
          <span className="we-logo"><Icon name="heart" size={22} color="#fff" /></span>
          <span className="col grow" style={{ gap: 0 }}>
            <b>{en && c.en.name ? c.en.name : doctor.name}</b>
            <span className="we-hint">{en && c.en.degrees ? c.en.degrees : doctor.degrees} · BMDC {doctor.bmdcNo}</span>
          </span>
          {!en && <Link className="btn btn-sm" href="/dashboard/profile">নাম/ডিগ্রি বদলান</Link>}
        </div>
        {en && (
          <div className="grid">
            <label className="field">Name (English)<input className="input" maxLength={80} value={c.en.name ?? ""} placeholder="Dr. Tanvir Ahmed" onChange={(e) => setT("name", e.target.value)} /></label>
            <label className="field">Degrees (English)<input className="input" maxLength={200} value={c.en.degrees ?? ""} placeholder="MBBS, FCPS (Medicine)" onChange={(e) => setT("degrees", e.target.value)} /></label>
          </div>
        )}
        <div className="grid">
          {txt("designation", "পদবি / বিশেষজ্ঞতা", "যেমন: হৃদরোগ ও উচ্চ রক্তচাপ বিশেষজ্ঞ", 0, 120)}
          {!en && (
            <label className="field">সিরিয়াল হটলাইন<input className="input" inputMode="tel" maxLength={20} value={c.hotline} placeholder="০১৭XXXXXXXX" onChange={(e) => setRoot("hotline", e.target.value)} />
              <span className="we-ref">উপরের বার, হেডার আর ফুটারে দেখাবে</span></label>
          )}
        </div>
        <div className="we-sub">
          <span className="col grow" style={{ gap: 0 }}><b>উপরের পাতলা বার</b><span className="we-hint">BMDC নাম্বার, একটা ছোট পরিচয় আর হটলাইন</span></span>
          <Switch {...sec("topbar")} label="উপরের বার দেখাবে" />
        </div>
        {c.sections.topbar && txt("topNote", "উপরের বারের ছোট লেখা (ঐচ্ছিক)", "যেমন: সিনিয়র কনসালট্যান্ট, রাজশাহী মেডিকেল কলেজ হাসপাতাল", 0, 140)}
        {!en && (
          <div className="field">
            <span>ওয়েবসাইটের রং</span>
            <div className="we-themes">
              {THEMES.map((t) => (
                <button key={t.id} type="button" className={`we-theme${c.theme === t.id ? " on" : ""}`} aria-pressed={c.theme === t.id} onClick={() => up((x) => ({ ...x, theme: t.id }))}>
                  <span className="we-sw"><i style={{ background: t.a }} /><i style={{ background: t.b }} /></span>{t.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </Step>

      <Step n={2} title="মূল অংশ — ছবি ও বড় শিরোনাম" hint="ওয়েবসাইট খুললেই রোগী প্রথমে এটা দেখবেন">
        {!en && (
          <div className="we-photo">
            <div className="we-photo-box">
              {photo ? <img src={photo} alt="ডাক্তারের ছবি" /> : <Icon name="user" size={44} color="#9AA8A4" />}
            </div>
            <div className="col" style={{ gap: 8 }}>
              <b>আপনার ছবি</b>
              <span className="we-hint">সাদা বা হালকা পটভূমিতে কোমর পর্যন্ত ছবি সবচেয়ে ভালো দেখায়। ছবি না দিলে নামের প্রথম অক্ষর দেখাবে।</span>
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}><Icon name="camera" size={16} />{photo ? "ছবি বদলান" : "ছবি দিন"}</button>
                {photo && <button type="button" className="btn btn-sm" onClick={() => { setPhoto(null); setPhotoOut("remove"); setDirty(true); }}><Icon name="trash" size={16} />সরান</button>}
              </div>
              {photoErr && <span className="we-err">{photoErr}</span>}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
          </div>
        )}
        {txt("heroTitle", "বড় শিরোনাম", "যেমন: হৃদরোগ ও উচ্চ রক্তচাপের যত্নশীল চিকিৎসা", 0, 120)}
        {txt("heroText", "ছোট বর্ণনা (২–৩ লাইন)", "কোন কোন সমস্যার চিকিৎসা করেন, কাদের জন্য…", 3, 400)}
        {!en && (
          <>
            <div className="we-sub">
              <span className="col grow" style={{ gap: 0 }}><b>সংখ্যার বক্স</b><span className="we-hint">আসল তথ্য থেকে আপনাআপনি — বানানো দাবি নয়</span></span>
              <Switch {...sec("stats")} label="সংখ্যার বক্স দেখাবে" />
            </div>
            {c.sections.stats && (
              <div className="we-checks">
                <label><input type="checkbox" checked={c.stats.experience} onChange={(e) => up((x) => ({ ...x, stats: { ...x.stats, experience: e.target.checked } }))} />অভিজ্ঞতা {doctor.experienceYears ? `(${doctor.experienceYears.toLocaleString("bn-BD")}+ বছর)` : "(প্রোফাইলে বছর দিন)"}</label>
                <label><input type="checkbox" checked={c.stats.patients} onChange={(e) => up((x) => ({ ...x, stats: { ...x.stats, patients: e.target.checked } }))} />DoctorsVilla-তে রোগী দেখেছেন</label>
                <label><input type="checkbox" checked={c.stats.chambers} onChange={(e) => up((x) => ({ ...x, stats: { ...x.stats, chambers: e.target.checked } }))} />চেম্বারের সংখ্যা</label>
              </div>
            )}
            <label className="field">WhatsApp নাম্বার (ঐচ্ছিক)<input className="input" inputMode="tel" maxLength={20} value={c.whatsapp} placeholder="০১৭XXXXXXXX" onChange={(e) => setRoot("whatsapp", e.target.value)} />
              <span className="we-ref">দিলে "WhatsApp-এ যোগাযোগ" বোতাম দেখাবে</span></label>
          </>
        )}
      </Step>

      <Step n={3} title="চিকিৎসা সেবাসমূহ" hint="কোন কোন সমস্যার চিকিৎসা করেন — কার্ড আকারে দেখাবে" {...sec("services")}>
        {txt("servicesTitle", "এই অংশের শিরোনাম", "যেমন: হৃদরোগের বিশেষায়িত চিকিৎসা", 0, 120)}
        {B.services.length === 0 && <p className="we-hint">এখনো কোনো সেবা নেই।</p>}
        {B.services.map((s, i) => {
          const cur = en ? c.en.services[i] ?? { title: "", desc: "" } : s;
          return (
            <div key={i} className="we-item">
              <div className="we-item-top">
                <span className="we-svc-ic"><Icon name={s.icon as keyof typeof ICON} size={20} /></span>
                <b className="grow">সেবা {(i + 1).toLocaleString("bn-BD")}</b>
                {!en && (
                  <span className="row" style={{ gap: 4 }}>
                    <button type="button" className="we-ib" aria-label="উপরে" onClick={() => services((l) => moveIn(l, i, -1))}><Icon name="up" size={16} /></button>
                    <button type="button" className="we-ib" aria-label="নিচে" onClick={() => services((l) => moveIn(l, i, 1))}><Icon name="down" size={16} /></button>
                    <button type="button" className="we-ib danger" aria-label="মুছুন" onClick={() => services((l) => l.filter((_, j) => j !== i))}><Icon name="trash" size={16} /></button>
                  </span>
                )}
              </div>
              {!en && (
                <div className="we-icons" role="radiogroup" aria-label="আইকন">
                  {ICONS.map((ic) => (
                    <button key={ic} type="button" role="radio" aria-checked={s.icon === ic} aria-label={ic} className={s.icon === ic ? "on" : ""} onClick={() => services((l) => l.map((x, j) => (j === i ? { ...x, icon: ic } : x)))}>
                      <Icon name={ic} size={18} />
                    </button>
                  ))}
                </div>
              )}
              <input className="input" maxLength={80} value={cur.title} placeholder={en ? s.title || "Title" : "শিরোনাম, যেমন: উচ্চ রক্তচাপ"} onChange={(e) => svcField(i, "title", e.target.value)} aria-label="সেবার শিরোনাম" />
              <textarea className="input" rows={2} maxLength={240} value={cur.desc} placeholder={en ? s.desc || "Short description" : "এক-দুই লাইনে বর্ণনা"} onChange={(e) => svcField(i, "desc", e.target.value)} aria-label="সেবার বর্ণনা" />
            </div>
          );
        })}
        {!en && B.services.length < 12 && (
          <button type="button" className="btn we-add" onClick={() => services((l) => [...l, { title: "", desc: "", icon: "steth" }])}><Icon name="plus" size={18} />সেবা যোগ করুন</button>
        )}
      </Step>

      <Step n={4} title="পরিচিতি" hint="আপনার সম্পর্কে বিস্তারিত — শিক্ষা, অভিজ্ঞতা, কোথায় কাজ করেন" {...sec("about")}>
        {txt("about", "পরিচিতি", "যেমন: রাজশাহী মেডিকেল কলেজ থেকে এমবিবিএস…", 7, 2500)}
      </Step>

      <Step n={5} title="চেম্বার ও অনলাইন সিরিয়াল" hint="চেম্বারের ঠিকানা, সময়, ফি আর সিরিয়াল ফর্ম">
        {chambers.length === 0 ? (
          <div className="we-empty">
            <Icon name="pin" size={22} />
            <span className="col" style={{ gap: 2 }}>
              <b>কোনো চেম্বার যোগ করা নেই — কোনো সমস্যা নেই</b>
              <span className="we-hint">চেম্বার না থাকলে ওয়েবসাইটে চেম্বার আর সিরিয়াল অংশ দেখাবে না; রোগীরা হটলাইনে যোগাযোগ করবেন। পরে চাইলে <Link href="/dashboard/chambers">চেম্বার যোগ করুন</Link>।</span>
            </span>
          </div>
        ) : (
          <>
            <ul className="we-chambers">
              {chambers.map((ch) => <li key={ch.id}><Icon name="pin" size={16} />{ch.name}, {ch.city}</li>)}
            </ul>
            <span className="we-hint">সময় বা ফি বদলাতে <Link href="/dashboard/chambers">চেম্বার সেটিং</Link>-এ যান — ওয়েবসাইটে নিজে থেকেই বদলে যাবে।</span>
            {!en && (
              <>
                <div className="we-sub">
                  <span className="col grow" style={{ gap: 0 }}><b>চেম্বার ও সময়সূচি দেখাবে</b><span className="we-hint">ঠিকানা, দিন, সময়, ফি আর ম্যাপ</span></span>
                  <Switch {...sec("chambers")} label="চেম্বার দেখাবে" />
                </div>
                <div className="we-sub">
                  <span className="col grow" style={{ gap: 0 }}><b>অনলাইন সিরিয়াল ফর্ম</b><span className="we-hint">রোগী ফর্ম পূরণ করলেই সাথে সাথে সিরিয়াল নম্বর পাবেন</span></span>
                  <Switch {...sec("booking")} label="সিরিয়াল ফর্ম দেখাবে" />
                </div>
              </>
            )}
          </>
        )}
      </Step>

      <Step n={6} title="প্রশ্নোত্তর" hint="রোগীরা প্রায়ই যা জিজ্ঞেস করেন — রিপোর্ট, ফি, সময়" {...sec("faq")}>
        {B.faqs.map((f, i) => {
          const cur = en ? c.en.faqs[i] ?? { q: "", a: "" } : f;
          return (
            <div key={i} className="we-item">
              <div className="we-item-top">
                <span className="we-svc-ic"><Icon name="help" size={20} /></span>
                <b className="grow">প্রশ্ন {(i + 1).toLocaleString("bn-BD")}</b>
                {!en && (
                  <span className="row" style={{ gap: 4 }}>
                    <button type="button" className="we-ib" aria-label="উপরে" onClick={() => faqs((l) => moveIn(l, i, -1))}><Icon name="up" size={16} /></button>
                    <button type="button" className="we-ib" aria-label="নিচে" onClick={() => faqs((l) => moveIn(l, i, 1))}><Icon name="down" size={16} /></button>
                    <button type="button" className="we-ib danger" aria-label="মুছুন" onClick={() => faqs((l) => l.filter((_, j) => j !== i))}><Icon name="trash" size={16} /></button>
                  </span>
                )}
              </div>
              <input className="input" maxLength={160} value={cur.q} placeholder={en ? f.q || "Question" : "প্রশ্ন"} onChange={(e) => faqField(i, "q", e.target.value)} aria-label="প্রশ্ন" />
              <textarea className="input" rows={2} maxLength={600} value={cur.a} placeholder={en ? f.a || "Answer" : "উত্তর"} onChange={(e) => faqField(i, "a", e.target.value)} aria-label="উত্তর" />
            </div>
          );
        })}
        {!en && B.faqs.length < 12 && (
          <button type="button" className="btn we-add" onClick={() => faqs((l) => [...l, { q: "", a: "" }])}><Icon name="plus" size={18} />প্রশ্ন যোগ করুন</button>
        )}
      </Step>

      <Step n={7} title="ফুটার — একদম নিচের অংশ" hint="যোগাযোগ, সোশ্যাল লিংক আর জরুরি সতর্কবার্তা">
        {!en && (
          <div className="grid">
            <label className="field">ইমেইল (ঐচ্ছিক)<input className="input" type="email" maxLength={120} value={c.email} placeholder="dr.name@gmail.com" onChange={(e) => setRoot("email", e.target.value)} /></label>
            <label className="field">ফেসবুক পেজ (ঐচ্ছিক)<input className="input" maxLength={300} value={c.facebook} placeholder="https://facebook.com/…" onChange={(e) => setRoot("facebook", e.target.value)} /></label>
            <label className="field">ইউটিউব (ঐচ্ছিক)<input className="input" maxLength={300} value={c.youtube} placeholder="https://youtube.com/…" onChange={(e) => setRoot("youtube", e.target.value)} /></label>
            <label className="field">লিংকডইন (ঐচ্ছিক)<input className="input" maxLength={300} value={c.linkedin} placeholder="https://linkedin.com/in/…" onChange={(e) => setRoot("linkedin", e.target.value)} /></label>
          </div>
        )}
        <div className="we-sub">
          <span className="col grow" style={{ gap: 0 }}><b>জরুরি সতর্কবার্তা</b><span className="we-hint">যেমন: বুকে তীব্র ব্যথায় অপেক্ষা না করে ইমার্জেন্সিতে যান</span></span>
          <Switch {...sec("emergency")} label="জরুরি সতর্কবার্তা দেখাবে" />
        </div>
        {c.sections.emergency && txt("emergency", "সতর্কবার্তার লেখা", "জরুরি অবস্থায় ৯৯৯-এ কল করুন…", 2, 300)}
      </Step>

      <p className="we-tip"><Icon name="shield" size={18} />BMDC-র নিয়ম মেনে চলুন: &quot;সেরা ডাক্তার&quot;, &quot;১০০% সুস্থ&quot; বা আগে-পরের ছবির মতো দাবি লিখবেন না। পেশাদার পরিচিতি আর রোগীর জন্য দরকারি তথ্য রাখুন।</p>

      <div className="we-save">
        <span className="we-status" aria-live="polite">
          {state?.error ? <span className="we-err">⚠ {state.error}</span> : state?.ok && !dirty ? <span className="we-ok">✓ {state.ok}</span> : dirty ? "সেভ করা হয়নি এমন পরিবর্তন আছে" : "সব সেভ করা আছে"}
        </span>
        <a className="btn" href={`/dr/${doctor.slug}?preview=1`} target="_blank" rel="noreferrer">প্রিভিউ</a>
        <button className="btn btn-primary" disabled={pending}>{pending ? "সেভ হচ্ছে…" : published ? "সেভ ও প্রকাশ করুন" : "সেভ করুন"}</button>
      </div>
    </form>
  );
}
