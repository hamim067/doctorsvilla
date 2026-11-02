import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";
import { Icon } from "@/components/Icons";
import { findDoctors, homeStats, openToday, type OpenChamber } from "@/lib/home";
import { bn, formatTimeBn } from "@/lib/time";
import { HomeMobileSearch } from "./HomeMobileSearch";
import "./home.css";

export const dynamic = "force-dynamic";

const TINTS = [
  ["#E3F1EE", "#0B6E5F"],
  ["#FFF4EC", "#C2551A"],
  ["#E8EEF8", "#2B5A8F"],
  ["#F1ECF7", "#5E3F8F"],
] as const;

const initials = (name: string) => name.replace(/^ডা\.?\s*/, "").slice(0, 2);

function slotText(o?: OpenChamber) {
  if (!o) return { text: "চেম্বারের সময় প্রোফাইলে দেখুন", ok: false };
  if (o.onlineLeft <= 0) return { text: "আজকের অনলাইন সিরিয়াল শেষ", ok: false };
  return { text: `আজ ${formatTimeBn(o.startTime)} থেকে · ${bn(o.onlineLeft)}টি খালি`, ok: true };
}

const STEPS = [
  { n: "১", h: "ডাক্তার খুঁজুন", p: "নাম, বিভাগ বা শহর দিয়ে খুঁজুন। চেম্বার, সময় আর ফি এক নজরে।", hm: "যাচাই করা ডাক্তার, বিভাগ বা শহর দিয়ে।" },
  { n: "২", h: "সিরিয়াল নিন", p: "তারিখ বেছে মোবাইল নাম্বার দিন। সিরিয়াল নাম্বার এসএমএসে চলে আসবে।", hm: "সিরিয়াল নাম্বার এসএমএসে চলে আসবে।" },
  { n: "৩", h: "সময়মতো পৌঁছান", p: "লাইভ দেখুন কত নম্বর চলছে। ২ জন বাকি থাকলেই রওনা দিন।", hm: "কত নম্বর চলছে দেখে সময়মতো পৌঁছান।" },
];

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; city?: string; track?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const city = (sp.city ?? "").trim();
  const searching = Boolean(q || city);

  const [open, doctors, stats] = await Promise.all([openToday(city || undefined), findDoctors(q, city || undefined, searching ? 30 : 8), homeStats()]);
  const openBySlug = new Map<string, OpenChamber>();
  for (const o of open) if (!openBySlug.has(o.slug) || o.onlineLeft > openBySlug.get(o.slug)!.onlineLeft) openBySlug.set(o.slug, o);
  const liveCount = open.filter((o) => o.current).length;
  const trackMissing = sp.track === "notfound";

  const results = (
    <section className="results" id="results" aria-live="polite">
      <h2>{q ? `“${q}”` : "ডাক্তার"}{city ? ` · ${city}` : ""} — {bn(doctors.length)} জন</h2>
      {doctors.length === 0 && <p className="muted">কোনো ডাক্তার পাওয়া যায়নি। অন্য নাম বা বিভাগ দিয়ে খুঁজে দেখুন।</p>}
      <div className="hd-doc-grid">
        {doctors.map((d, i) => <DoctorCard key={d.id} d={d} i={i} open={openBySlug.get(d.slug)} />)}
      </div>
      <Link href="/" className="small">← খোঁজা মুছে দিন</Link>
    </section>
  );

  const trackForm = (dark: boolean) => (
    <form action="/track" className={dark ? "track track-dark" : "track"}>
      <label>
        <span className="sr">সিরিয়াল কোড</span>
        <input name="code" placeholder="সিরিয়াল কোড, যেমন RAJ-1102-07" required />
      </label>
      <button>ট্র্যাক করুন</button>
      {trackMissing && <p className="track-err" role="alert">এই কোডের কোনো সিরিয়াল পাওয়া যায়নি — এসএমএসে আসা কোডটা আবার দেখুন।</p>}
    </form>
  );

  return (
    <main>
      {/* ================= ডেস্কটপ (ডিজাইন A) ================= */}
      <div className="hd">
        <header className="hd-wrap hd-nav">
          <Link href="/" className="hd-logo"><span className="hd-mark"><Icon name="pulse" size={24} stroke={2.4} color="#fff" /></span>DoctorOS</Link>
          <nav>
            <a href="#results">ডাক্তার খুঁজুন</a>
            <a href="#how">কীভাবে কাজ করে</a>
            <a href="#for-doctors">ডাক্তারদের জন্য</a>
          </nav>
          <ThemeToggle className="home-mode" label={false} />
          <Link href="/login" className="btn-o">ডাক্তার লগইন</Link>
          <Link href="/me" className="btn-d"><span className="dot" />আমার সিরিয়াল</Link>
        </header>

        <section className="hd-wrap">
          <div className="hd-hero">
            <div className="hd-hero-text">
              <span className="pill"><span>নতুন</span>বাসা থেকেই দেখুন কত নম্বর চলছে</span>
              <h1>চেম্বারে আর ঘণ্টার পর ঘণ্টা বসে থাকা নয়</h1>
              <p className="lead">যাচাই করা ডাক্তার খুঁজুন, ঘরে বসে সিরিয়াল নিন, আর ফোনেই দেখুন কখন আপনার পালা আসবে।</p>
              <form action="/" className="hd-search" role="search">
                <label className="grow">
                  <Icon name="search" size={20} color="#55635F" />
                  <span className="sr">ডাক্তার বা বিভাগ</span>
                  <input name="q" defaultValue={q} placeholder="ডাক্তারের নাম বা বিভাগ" />
                </label>
                {stats.cities.length > 1 && (
                  <label>
                    <Icon name="pin" size={20} color="#55635F" />
                    <span className="sr">শহর</span>
                    <select name="city" defaultValue={city}>
                      <option value="">সব শহর</option>
                      {stats.cities.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                )}
                <button>খুঁজুন</button>
              </form>
              <div className="popular">
                <span>জনপ্রিয়:</span>
                {SPEC_POPULAR.map((s) => <Link key={s.q} href={`/?q=${encodeURIComponent(s.q)}#results`}>{s.label}</Link>)}
              </div>
            </div>
            <div className="hd-hero-art" aria-hidden="true">
              <div className="phone">
                <div className="phone-in">
                  <div className="row-sb small"><span className="soft">উদাহরণ</span><span className="live-pill"><span className="dot" />লাইভ</span></div>
                  <span className="soft center" style={{ marginTop: 8 }}>এখন চলছে</span>
                  <span className="phone-num">৪</span>
                  <div className="phone-card">
                    <div className="row-sb" style={{ alignItems: "flex-end" }}>
                      <span className="col"><span className="xs muted">আপনার সিরিয়াল</span><span className="baloo teal" style={{ fontSize: 34, lineHeight: 1 }}>৭</span></span>
                      <span className="col right"><span className="xs muted">অপেক্ষা</span><span style={{ fontSize: 22, fontWeight: 700, color: "#C2551A" }}>~৩০ মিনিট</span></span>
                    </div>
                    <div className="bar">{["#0B6E5F", "#0B6E5F", "#0B6E5F", "#C2551A", "#DCE3E0", "#DCE3E0", "#5BD6A4"].map((c, i) => <span key={i} style={{ background: c }} />)}</div>
                    <span className="xs muted">আপনার আগে আর ৩ জন</span>
                  </div>
                </div>
              </div>
              <div className="float f1"><span className="fi orange"><Icon name="bell" size={20} /></span><span>আপনার সিরিয়াল আসতে আর ২ জন — রওনা দিন</span></div>
              <div className="float f2"><span className="fi teal-solid"><Icon name="check" size={18} stroke={3} /></span><span className="col"><b>BMDC যাচাইকৃত</b><span className="xs muted">প্রতিটি ডাক্তার</span></span></div>
            </div>
          </div>
        </section>

        {searching && <div className="hd-wrap">{results}</div>}

        <section className="hd-wrap hd-trust">
          {[
            { h: "যাচাই করা ডাক্তার", p: "BMDC নাম্বার মিলিয়ে দেখা হয়", i: "shield" as const },
            { h: "লাইভ সিরিয়াল", p: "কত নম্বর চলছে, সব সময় জানুন", i: "pulse" as const },
            { h: "অটো রিমাইন্ডার", p: "ফলোআপের আগের দিন এসএমএস", i: "bell" as const },
            { h: "পরিবারের ফাইল", p: "এক নাম্বারে সবার প্রেসক্রিপশন", i: "family" as const },
          ].map((t) => (
            <div key={t.h} className="trust">
              <span className="ti"><Icon name={t.i} /></span>
              <span className="col"><b>{t.h}</b><span className="small muted">{t.p}</span></span>
            </div>
          ))}
        </section>

        <section className="hd-wrap hd-sec">
          <div className="sec-head">
            <div className="col"><span className="eyebrow">বিভাগ</span><h2>কোন সমস্যার ডাক্তার খুঁজছেন?</h2></div>
          </div>
          <div className="spec-grid">
            {stats.specCounts.map((s, i) => (
              <Link key={s.name} href={`/?q=${encodeURIComponent(s.q)}#results`} className="spec" style={{ background: TINTS[i % 4][0] }}>
                <span className="spec-ic" style={{ color: TINTS[i % 4][1] }}><Icon name={s.icon} size={28} stroke={1.9} /></span>
                <span className="col"><b>{s.name}</b><span className="small" style={{ color: "#3A4845" }}>{s.count ? `${bn(s.count)} জন ডাক্তার` : "শীঘ্রই আসছে"}</span></span>
              </Link>
            ))}
          </div>
        </section>

        {!searching && doctors.length > 0 && (
          <section className="hd-wrap hd-sec" id="results">
            <div className="sec-head">
              <div className="col"><span className="eyebrow">সিরিয়াল নিন</span><h2>আমাদের ডাক্তাররা</h2></div>
            </div>
            <div className="hd-doc-grid">
              {doctors.map((d, i) => <DoctorCard key={d.id} d={d} i={i} open={openBySlug.get(d.slug)} />)}
            </div>
          </section>
        )}

        <section className="hd-wrap hd-sec" id="how">
          <div className="col center"><span className="eyebrow">মাত্র ৩ ধাপে</span><h2>কীভাবে কাজ করে</h2></div>
          <div className="steps">
            {STEPS.map((s) => (
              <div key={s.n} className="step"><span className="baloo teal step-n">{s.n}</span><b>{s.h}</b><span className="muted-2">{s.p}</span></div>
            ))}
          </div>
        </section>

        <section className="hd-wrap hd-sec" id="track">
          <div className="hd-live">
            <div className="col gap18 grow">
              <span className="eyebrow mint">লাইভ সিরিয়াল</span>
              <h2>ঠিক কখন যাবেন, ফোনই বলে দেবে</h2>
              <p>চেম্বারে প্রতিটি রোগী দেখা শেষ হলেই নাম্বার আপডেট হয়। আপনার আগে কতজন আর আনুমানিক কত মিনিট — সব সময় চোখের সামনে।</p>
              {trackForm(true)}
            </div>
            <div className="board" aria-hidden="true">
              <div className="board-now"><span>এখন চলছে</span><b>১২</b></div>
              <div className="board-next">
                {[["১৩", "প্রস্তুত থাকুন", "#F3B48A"], ["১৪", "অপেক্ষমাণ", "#B9D3CD"], ["১৫", "অপেক্ষমাণ", "#B9D3CD"]].map(([n, s, c]) => (
                  <div key={n}><b>{n}</b><span style={{ color: c }}>{s}</span></div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="hd-wrap hd-sec" id="for-doctors">
          <div className="hd-cta">
            <div className="col gap16 grow">
              <span className="eyebrow">আপনি কি ডাক্তার?</span>
              <h2>আপনার চেম্বার, আপনার ব্র্যান্ড — এক জায়গায়</h2>
              <div className="cta-points">
                {["অনলাইন সিরিয়াল ও লাইভ কিউ", "অটোমেটিক ফলোআপ রিমাইন্ডার", "নিজস্ব প্রোফাইল পেজ", "ডিজিটাল প্রেসক্রিপশন", "অ্যাসিস্ট্যান্টের আলাদা লগইন", "চেম্বারের টিভি ডিসপ্লে"].map((p) => (
                  <span key={p}><span className="ck"><Icon name="check" size={14} stroke={3} /></span>{p}</span>
                ))}
              </div>
            </div>
            <div className="col gap12" style={{ flex: "0 1 300px" }}>
              <Link href="/register" className="btn-big">ফ্রি অ্যাকাউন্ট খুলুন</Link>
              <Link href="/login" className="btn-big-o">লগইন</Link>
            </div>
          </div>
        </section>

        <footer className="hd-wrap hd-foot">
          <div className="foot-top">
            <div className="col gap8" style={{ maxWidth: 320 }}><span className="baloo" style={{ fontSize: 24 }}>DoctorOS</span><span className="muted">বাংলাদেশের ডাক্তার ও রোগীদের জন্য সিরিয়াল আর চেম্বার ব্যবস্থাপনা।</span></div>
            <div className="foot-links">
              <div className="col gap8"><b>রোগীদের জন্য</b><a href="#results">ডাক্তার খুঁজুন</a><Link href="/me">আমার সিরিয়াল ও ফাইল</Link></div>
              <div className="col gap8"><b>ডাক্তারদের জন্য</b><Link href="/register">অ্যাকাউন্ট খুলুন</Link><Link href="/login">লগইন</Link></div>
            </div>
          </div>
          <span className="small muted">© DoctorOS · জরুরি অবস্থায় নিকটস্থ হাসপাতালে যোগাযোগ করুন</span>
        </footer>
      </div>

      {/* ================= মোবাইল (ডিজাইন B) ================= */}
      <div className="hm">
        <div className="hm-top">
          <header className="row-sb">
            <span className="hm-logo"><span className="hm-mark"><Icon name="plus" size={16} stroke={2.8} color="#5BD6A4" /></span>DoctorOS</span>
            <span className="row" style={{ gap: 8 }}><ThemeToggle className="home-mode on-dark" label={false} /><Link href="/me" className="hm-login">আমার সিরিয়াল</Link></span>
          </header>
          {liveCount > 0 && <span className="hm-live"><span className="dot" />এখন {bn(liveCount)}টি চেম্বারে লাইভ সিরিয়াল</span>}
          <h1>সঠিক ডাক্তার।<br /><span>সঠিক সময়ে।</span></h1>
          <p>ঘরে বসে সিরিয়াল নিন, লাইভ দেখুন কখন আপনার পালা।</p>
          <HomeMobileSearch q={q} city={city} cities={stats.cities} />
        </div>

        {searching ? (
          <div className="hm-results">{results}</div>
        ) : (
          <section className="hm-card">
            <span className="hm-card-h"><span className="dot orange" />আজ খোলা চেম্বার</span>
            {open.length === 0 && <span className="small muted">আজ কোনো চেম্বার খোলা নেই।</span>}
            {open.slice(0, 4).map((o) => (
              <Link key={o.chamberId} href={`/dr/${o.slug}/book?chamber=${o.chamberId}`} className="hm-open">
                <span className="hm-now"><span>{o.current ? "চলছে" : "শুরু"}</span><b>{o.current ? bn(o.current) : formatTimeBn(o.startTime).split(" ")[1]}</b></span>
                <span className="col grow">
                  <b>{o.doctorName}</b>
                  <span className="small muted">{o.specialty} · {o.chamberName}</span>
                  <span className="small" style={{ fontWeight: 600, color: o.onlineLeft > 0 ? "#0B6E5F" : "#8A3A10" }}>{o.onlineLeft > 0 ? `${bn(o.onlineLeft)}টি সিরিয়াল খালি` : "আজকের অনলাইন সিরিয়াল শেষ"}</span>
                </span>
                <Icon name="chevron" size={18} stroke={2.2} color="#0B6E5F" />
              </Link>
            ))}
          </section>
        )}

        <section className="hm-sec">
          <span className="eyebrow">বিভাগ</span>
          <h2>আপনার সমস্যা, সঠিক বিশেষজ্ঞ</h2>
          {stats.specCounts.map((s, i) => (
            <Link key={s.name} href={`/?q=${encodeURIComponent(s.q)}`} className="hm-spec">
              <span className="row"><span className="hm-idx">{bn(String(i + 1).padStart(2, "0"))}</span><span>{s.name}</span></span>
              <Icon name="arrow" size={18} color="#0B6E5F" />
            </Link>
          ))}
        </section>

        <section className="hm-steps">
          {STEPS.map((s, i) => (
            <div key={s.n} className={`hm-step s${i}`}><span className="hm-step-n">{s.n}</span><span className="col"><b>{s.h}</b><span>{s.hm}</span></span></div>
          ))}
        </section>

        <section className="hm-sec" id="track-m">
          <span className="eyebrow">সিরিয়াল নিয়েছেন?</span>
          <h2>লাইভ দেখুন কত নম্বর চলছে</h2>
          {trackForm(false)}
        </section>

        <section className="hm-cta">
          <h2>ডাক্তার? চেম্বার ডিজিটাল করুন আজই</h2>
          <span>অনলাইন সিরিয়াল, লাইভ কিউ আর ফলোআপ রিমাইন্ডার।</span>
          <Link href="/register">ফ্রি শুরু করুন</Link>
        </section>
        <footer className="hm-foot"><b>DoctorOS</b> · <Link href="/login">ডাক্তার লগইন</Link> · জরুরি অবস্থায় নিকটস্থ হাসপাতালে যোগাযোগ করুন</footer>
      </div>
    </main>
  );
}

const SPEC_POPULAR = [
  { label: "হৃদরোগ", q: "হৃদ" },
  { label: "দাঁতের ডাক্তার", q: "দন্ত" },
  { label: "শিশু বিশেষজ্ঞ", q: "শিশু" },
  { label: "গাইনি", q: "গাইনি" },
];

type Doc = Awaited<ReturnType<typeof findDoctors>>[number];

function DoctorCard({ d, i, open }: { d: Doc; i: number; open?: OpenChamber }) {
  const [bg, fg] = TINTS[i % 4];
  const slot = slotText(open);
  return (
    <div className="doc">
      <div className="row" style={{ gap: 14 }}>
        <span className="doc-av baloo" style={{ background: bg, color: fg }}>{initials(d.name)}</span>
        <span className="col" style={{ gap: 2, minWidth: 0 }}>
          <Link href={`/dr/${d.slug}`} className="doc-name">{d.name}</Link>
          <span className="small muted">{d.specialty} · {d.degrees}</span>
          {d.verified && <span className="vbadge">✓ BMDC যাচাইকৃত</span>}
        </span>
      </div>
      <div className="doc-slot">
        <span>{d.chamberName}, {d.city}</span>
        <span style={{ fontWeight: 600, color: slot.ok ? "#0B6E5F" : "#55635F" }}>{slot.text}</span>
      </div>
      <div className="row-sb">
        <span><span className="muted">ফি</span> <b>৳{bn(d.fee)}</b></span>
        <Link href={`/dr/${d.slug}/book`} className="btn-s">সিরিয়াল নিন</Link>
      </div>
    </div>
  );
}
