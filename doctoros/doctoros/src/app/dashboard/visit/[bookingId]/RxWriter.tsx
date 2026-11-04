"use client";
import Link from "next/link";
import { Fragment, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import { ScaledPad } from "@/components/ScaledPad";
import type { Medicine, RxTemplateData } from "@/db/schema";
import type { PadData, PadSettings } from "@/lib/rxpad";
import { autosavePrescription, deleteRxTemplate, saveRxTemplate, savePrescription } from "../actions";

type MedHabit = { name: string; dose: string; when: string; days: string; n: number };
type Habits = { meds: MedHabit[]; complaints: string[]; diagnoses: string[]; tests: string[]; advice: string[] };
type Tpl = { id: string; name: string; data: RxTemplateData };
type Vit = { bp: string; pulse: string; weight: string; temp: string; spo2: string; sugar: string };
type Props = {
  bookingId: string; backHref: string; historyHref: string; minDate: string; chamberName: string;
  patient: { name: string; code: string; age: string | null; gender: string | null; serial: string; visitNo: string; date: string; allergies: string[]; conditions: string[] };
  lastVitals: { date: string; bp: string | null; bpHigh: boolean; sugar: string | null; weight: string | null; by: string } | null;
  currentMeds: Medicine[];
  pastVisits: { id: string; bookingId: string | null; date: string; year: string; dx: string; medicines: Medicine[] }[];
  habits: Habits; templates: Tpl[]; pad: PadSettings; padBase: PadData;
  initial: { complaint: string; diagnosis: string; advice: string; investigations: string; medicines: Medicine[]; followUpDate: string | null; vitals: Vit; vitalsBy: string };
};

const DOSES = ["১+০+০", "০+১+০", "০+০+১", "১+০+১", "১+১+১", "০+১+১"];
const WHENS = ["খাবারের আগে", "খাবারের পরে", "খালি পেটে", "রাতে শোয়ার আগে"];
const DAYS = ["৩ দিন", "৫ দিন", "৭ দিন", "১৪ দিন", "১ মাস", "৩ মাস", "চলবে"];
const FU = [["", "লাগবে না"], ["7", "৭ দিন"], ["15", "১৫ দিন"], ["30", "১ মাস"], ["90", "৩ মাস"], ["date", "তারিখ"]] as const;
const bnD = (s: string) => s.replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
const key = (n: string) => n.trim().toLowerCase().replace(/^(tab|cap|syp|inj|susp|drop|oint|cream)\.?\s+/i, "").split(/\s+/)[0];

// অ্যালার্জির সাথে মেলে এমন ওষুধের পরিবার — শুধু সাবধান করার জন্য, পূর্ণ তালিকা নয়
const FAMILY: Record<string, string[]> = {
  penicillin: ["penicillin", "amoxicillin", "ampicillin", "flucloxacillin", "cloxacillin", "co-amoxiclav", "phenoxymethyl"],
  "পেনিসিলিন": ["penicillin", "amoxicillin", "ampicillin", "flucloxacillin", "cloxacillin", "co-amoxiclav", "phenoxymethyl"],
  sulfa: ["sulfamethoxazole", "cotrimoxazole", "co-trimoxazole", "sulfasalazine"],
  "সালফা": ["sulfamethoxazole", "cotrimoxazole", "co-trimoxazole", "sulfasalazine"],
  nsaid: ["ibuprofen", "diclofenac", "naproxen", "aspirin", "ketorolac", "aceclofenac", "etoricoxib", "mefenamic"],
  "ব্যথার ওষুধ": ["ibuprofen", "diclofenac", "naproxen", "aspirin", "ketorolac", "aceclofenac"],
  aspirin: ["aspirin", "ecosprin", "disprin"],
};
function allergyHit(name: string, allergies: string[]) {
  const n = name.toLowerCase();
  for (const a of allergies) {
    const al = a.toLowerCase();
    if (al.length >= 4 && n.includes(al)) return a;
    const fam = Object.entries(FAMILY).find(([k]) => al.includes(k));
    if (fam && fam[1].some((x) => n.includes(x))) return a;
  }
  return null;
}

/** তালিকাভিত্তিক ঘর — চিপে চাপলে যোগ/বাদ, হাতে লেখাও যায় */
function useList(initial: string, sep: string, re = /[,،;।\n]+/) {
  const [text, setText] = useState(initial);
  const items = text.split(re).map((x) => x.trim()).filter(Boolean);
  const has = (v: string) => items.some((x) => x.toLowerCase() === v.toLowerCase());
  const toggle = (v: string) => setText(has(v) ? items.filter((x) => x.toLowerCase() !== v.toLowerCase()).join(sep) : [...items, v].join(sep));
  return { text, setText, has, toggle, items };
}

function Chips({ list, has, toggle }: { list: string[]; has: (v: string) => boolean; toggle: (v: string) => void }) {
  return <div className="rw-chips">{list.map((v) => <button type="button" key={v} className={`rw-chip${has(v) ? " on" : ""}`} aria-pressed={has(v)} onClick={() => toggle(v)}>{has(v) && <Icon name="check" size={14} stroke={3} />}{v}</button>)}</div>;
}

export function RxWriter(P: Props) {
  const { patient: pt, habits } = P;
  const [state, action, pending] = useActionState(savePrescription, undefined);
  const cc = useList(P.initial.complaint, ", ");
  const dx = useList(P.initial.diagnosis, ", ");
  const inv = useList(P.initial.investigations, ", ", /[,\n]+/);
  const adv = useList(P.initial.advice, "\n", /[\n]+/);
  const [meds, setMeds] = useState<Medicine[]>(P.initial.medicines);
  const [vit, setVit] = useState<Vit>(P.initial.vitals);
  const [fu, setFu] = useState<string>(P.initial.followUpDate ? "date" : "");
  const [fuDate, setFuDate] = useState(P.initial.followUpDate ?? "");
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const [flash, setFlash] = useState("");
  const [templates, setTemplates] = useState(P.templates);
  const [tplName, setTplName] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [openCustom, setOpenCustom] = useState<Record<string, boolean>>({});
  const searchRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const saveBtn = useRef<HTMLButtonElement>(null), nextBtn = useRef<HTMLButtonElement>(null), printBtn = useRef<HTMLButtonElement>(null);

  // ---------- অটো-সেভ ----------
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [auto, setAuto] = useState<{ t: "idle" | "saving" | "saved" | "error"; at?: string }>({ t: "idle" });
  const first = useRef(true);
  const flush = async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const f = formRef.current; if (!f) return;
    setAuto({ t: "saving" });
    const r = await autosavePrescription(new FormData(f)).catch(() => ({ ok: false, at: undefined }));
    setAuto(r.ok ? (r.at ? { t: "saved", at: r.at } : { t: "idle" }) : { t: "error" });
  };
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 1800);
  }, [cc.text, dx.text, inv.text, adv.text, meds, vit, fu, fuDate]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const hide = () => { if (document.visibilityState === "hidden" && timer.current) flush(); };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // মোবাইলে সারাংশ বন্ধ থাকে — আগে লেখার জায়গা
  useEffect(() => { if (window.innerWidth <= 900) document.querySelectorAll<HTMLDetailsElement>(".rw-sum").forEach((d) => { d.open = false; }); }, []);

  // ---------- কিবোর্ড শর্টকাট ----------
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "Enter") { e.preventDefault(); nextBtn.current?.click(); }
      else if (e.key.toLowerCase() === "s") { e.preventDefault(); saveBtn.current?.click(); }
      else if (e.key.toLowerCase() === "p") { e.preventDefault(); printBtn.current?.click(); }
      else if (e.key.toLowerCase() === "k") { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  // ---------- ওষুধ ----------
  const say = (t: string) => { setFlash(t); setTimeout(() => setFlash(""), 2600); };
  const addMeds = (list: Medicine[]) => setMeds((cur) => {
    const have = new Set(cur.map((m) => key(m.name)));
    const add = list.filter((m) => m.name.trim() && !have.has(key(m.name)) && have.add(key(m.name)));
    if (add.length < list.filter((m) => m.name.trim()).length) say("যেগুলো আগেই লেখা ছিল, সেগুলো আবার বসানো হয়নি");
    return [...cur, ...add];
  });
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return habits.meds.filter((m) => m.name.toLowerCase().includes(s))
      .sort((a, b) => Number(b.name.toLowerCase().startsWith(s)) - Number(a.name.toLowerCase().startsWith(s)) || b.n - a.n).slice(0, 7);
  }, [q, habits.meds]);
  const pick = (m: MedHabit | null) => {
    const name = (m?.name ?? q).trim();
    if (!name) return;
    if (meds.some((x) => key(x.name) === key(name))) { say(`${name} আগেই লেখা আছে`); setQ(""); return; }
    setMeds((cur) => [...cur, { name, dose: m?.dose ?? "", when: m?.when ?? "", days: m?.days ?? "" }]);
    setQ(""); setHi(0); searchRef.current?.focus();
  };
  const upd = (i: number, k: keyof Medicine, v: string) => setMeds((m) => m.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const move = (i: number, d: -1 | 1) => setMeds((m) => { const a = [...m]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });
  const warns = meds.map((m) => allergyHit(m.name, pt.allergies)).filter(Boolean) as string[];

  // ---------- টেমপ্লেট ----------
  const applyTpl = (t: Tpl) => {
    const d = t.data;
    if (d.complaint) cc.setText((cur) => [...new Set([...cur.split(/[,،;।\n]+/).map((s) => s.trim()).filter(Boolean), ...d.complaint.split(/[,،;।\n]+/).map((s) => s.trim()).filter(Boolean)])].join(", "));
    if (d.diagnosis) dx.setText((cur) => [...new Set([...cur.split(/[,،;।\n]+/).map((s) => s.trim()).filter(Boolean), ...d.diagnosis.split(/[,،;।\n]+/).map((s) => s.trim()).filter(Boolean)])].join(", "));
    if (d.investigations) inv.setText((cur) => [...new Set([...cur.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean), ...d.investigations.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean)])].join(", "));
    if (d.advice) adv.setText((cur) => [...new Set([...cur.split(/\n+/).map((s) => s.trim()).filter(Boolean), ...d.advice.split(/\n+/).map((s) => s.trim()).filter(Boolean)])].join("\n"));
    addMeds(d.medicines);
    if (d.followUp) setFu(d.followUp);
    say(`"${t.name}" বসানো হয়েছে — দরকার হলে বদলে নিন`);
  };
  const saveTpl = async () => {
    const name = (tplName ?? "").trim();
    if (!name) return;
    const data: RxTemplateData = { complaint: cc.text, diagnosis: dx.text, medicines: meds, advice: adv.text, investigations: inv.text, followUp: fu === "date" ? "" : fu };
    const r = await saveRxTemplate({ name, data });
    if (r.error) { say(r.error); return; }
    setTemplates((ts) => [...ts.filter((t) => t.name !== name), { id: r.id!, name, data }].sort((a, b) => a.name.localeCompare(b.name)));
    setTplName(null); say(`টেমপ্লেট "${name}" সেভ হয়েছে`);
  };

  // ---------- লাইভ প্যাড ----------
  const fuLabel = fu === "date" ? fuDate : fu ? FU.find(([v]) => v === fu)?.[1] + " পর" : "";
  const padData: PadData = {
    ...P.padBase,
    visit: { complaint: cc.text || null, diagnosis: dx.text || null, medicines: meds.filter((m) => m.name.trim()), advice: adv.text || null, investigations: inv.text || null, followUp: fuLabel ? bnD(fuLabel) : null },
    vitals: {
      ...(vit.bp ? { bp: bnD(vit.bp) } : {}), ...(vit.pulse ? { pulse: `${bnD(vit.pulse)}/min` } : {}), ...(vit.weight ? { weight: `${bnD(vit.weight)} kg` } : {}),
      ...(vit.temp ? { temp: `${bnD(vit.temp)}°F` } : {}), ...(vit.spo2 ? { spo2: `${bnD(vit.spo2)}%` } : {}),
    },
  };
  const filled = meds.length > 0 || cc.text || dx.text;
  const padBox = <div className="rw-padbox"><ScaledPad s={P.pad} d={padData} /></div>;

  return (
    <form ref={formRef} action={action} className="rw" onKeyDown={(e) => {
      // ঘরে Enter চাপলে ভুল করে প্রিন্ট/সেভ যেন না হয় (Ctrl+Enter আলাদা)
      const t = e.target as HTMLElement;
      if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && t.tagName === "INPUT") e.preventDefault();
    }}>
      {/* ফর্মে যা জমা হবে */}
      <input type="hidden" name="bookingId" value={P.bookingId} />
      <input type="hidden" name="complaint" value={cc.text} />
      <input type="hidden" name="diagnosis" value={dx.text} />
      <input type="hidden" name="investigations" value={inv.text} />
      <input type="hidden" name="advice" value={adv.text} />
      {meds.map((m, i) => (
        <span key={i} hidden><input name="med-name" value={m.name} readOnly /><input name="med-dose" value={m.dose} readOnly /><input name="med-when" value={m.when} readOnly /><input name="med-days" value={m.days} readOnly /></span>
      ))}
      <input type="hidden" name="followUp" value={fu} />
      {fu === "date" && <input type="hidden" name="followUpDate" value={fuDate} />}

      {/* ---------- ১. রোগীর বার ---------- */}
      <header className="rw-top">
        <Link href={P.backHref} className="rw-back" aria-label="সিরিয়াল কিউতে ফিরুন"><Icon name="chevron" size={20} /></Link>
        <span className="rw-av">{pt.name.slice(0, 1)}</span>
        <span className="rw-who">
          <b>{pt.name}{pt.age ? ` · ${pt.age} বছর` : ""}{pt.gender ? ` · ${pt.gender}` : ""}</b>
          <small>{pt.code} · সিরিয়াল {pt.serial} · {pt.visitNo === "১" ? "নতুন রোগী" : `${pt.visitNo}তম ভিজিট`} · {pt.date}</small>
        </span>
        <span className="rw-flags">
          {pt.allergies.length > 0 && <span className="rw-flag red"><Icon name="alert" size={15} />অ্যালার্জি: {pt.allergies.join(", ")}</span>}
          {pt.conditions.length > 0 && <span className="rw-flag amb">{pt.conditions.join(" · ")}</span>}
        </span>
        <span className="rw-acts">
          <span className={`rw-auto ${auto.t}`} aria-live="polite">{auto.t === "saving" ? "সেভ হচ্ছে…" : auto.t === "saved" ? `✓ সেভ হয়েছে ${bnD(auto.at ?? "")}` : auto.t === "error" ? "⚠ সেভ হয়নি" : "লিখলেই নিজে থেকে সেভ"}</span>
          <button type="button" className="btn rw-pvbtn" onClick={() => setPreview(true)}><Icon name="layout" size={17} />প্যাড দেখুন</button>
          <button ref={printBtn} className="btn" name="next" value="print" disabled={pending} title="Ctrl + P"><Icon name="external" size={17} />প্রিন্ট</button>
          <button ref={nextBtn} className="btn btn-primary rw-next" name="next" value="1" disabled={pending} title="Ctrl + Enter">{pending ? "সেভ হচ্ছে…" : "সেভ করে পরের রোগী →"}</button>
          <button ref={saveBtn} hidden tabIndex={-1} disabled={pending}>শুধু সেভ</button>
        </span>
      </header>
      {state?.error && <p className="alert alert-error" role="alert">{state.error}</p>}
      {state?.ok && <p className="alert alert-ok" role="status">{state.ok}</p>}
      {flash && <p className="rw-flash" role="status">{flash}</p>}

      <div className="rw-grid">
        {/* ---------- ২. বামে রোগীর সারাংশ ---------- */}
        <aside className="rw-side">
          <details className="rw-card rw-sum" open>
            <summary><h3>শেষ মাপ{P.lastVitals ? ` (${P.lastVitals.date})` : ""}</h3></summary>
            {P.lastVitals ? (
              <dl className="rw-kv">
                {P.lastVitals.bp && <><dt>প্রেসার</dt><dd className={P.lastVitals.bpHigh ? "hi" : ""}>{P.lastVitals.bp}{P.lastVitals.bpHigh ? " ↑" : ""}</dd></>}
                {P.lastVitals.sugar && <><dt>সুগার</dt><dd>{P.lastVitals.sugar}</dd></>}
                {P.lastVitals.weight && <><dt>ওজন</dt><dd>{P.lastVitals.weight}</dd></>}
              </dl>
            ) : <p className="rw-none">আগের কোনো মাপ নেই</p>}
          </details>
          <details className="rw-card rw-sum" open>
            <summary><h3>এখন যে ওষুধ চলছে</h3></summary>
            {P.currentMeds.length ? (
              <>
                <dl className="rw-kv">{P.currentMeds.map((m) => <Fragment key={m.name}><dt>{m.name}</dt><dd className="sm">{m.dose}</dd></Fragment>)}</dl>
                <button type="button" className="btn btn-block rw-copy" onClick={() => { addMeds(P.currentMeds); say("চলমান ওষুধ বসানো হয়েছে"); }}><Icon name="plus" size={16} />সব আবার লিখুন</button>
              </>
            ) : <p className="rw-none">আপনার লেখা কোনো চলমান ওষুধ নেই</p>}
          </details>
          <details className="rw-card rw-sum" open>
            <summary><h3>আগের ভিজিট</h3></summary>
            {P.pastVisits.length ? (
              <ul className="rw-past">
                {P.pastVisits.map((v) => (
                  <li key={v.id}>
                    <span><b>{v.date} {v.year}</b><small>{v.dx || "—"}{v.medicines.length ? ` · ${bnD(String(v.medicines.length))}টি ওষুধ` : ""}</small></span>
                    {v.medicines.length > 0 && <button type="button" className="rw-mini" onClick={() => { addMeds(v.medicines); say(`${v.date}-এর ওষুধ বসানো হয়েছে`); }} title="এই ভিজিটের ওষুধ কপি করুন">কপি</button>}
                  </li>
                ))}
              </ul>
            ) : <p className="rw-none">এই প্রথম আপনার কাছে এসেছেন</p>}
            <Link href={P.historyHref} className="rw-link">পুরো ইতিহাস →</Link>
          </details>
        </aside>

        {/* ---------- মাঝে লেখার জায়গা ---------- */}
        <div className="rw-main">
          <section className="rw-card">
            <div className="rw-h"><h3>আজকের মাপ</h3>{P.initial.vitalsBy && <small>{P.initial.vitalsBy}</small>}</div>
            <div className="rw-vit">
              {([["bp", "BP", "১২০/৮০"], ["pulse", "পালস", "৭২"], ["weight", "ওজন kg", "৬৫"], ["temp", "তাপ °F", "৯৮.৬"], ["spo2", "SpO₂ %", "৯৮"], ["sugar", "সুগার", "mmol/L"]] as const).map(([k, l, ph]) => (
                <label key={k}><span>{l}</span><input className="input" name={`v-${k}`} inputMode={k === "bp" ? "text" : "decimal"} value={vit[k]} placeholder={ph} onChange={(e) => setVit({ ...vit, [k]: e.target.value })} /></label>
              ))}
            </div>
          </section>

          <section className="rw-card">
            <div className="rw-h"><h3>অভিযোগ (C/C)</h3></div>
            <Chips list={[...new Set([...cc.items, ...habits.complaints])]} has={cc.has} toggle={cc.toggle} />
            <input className="input rw-free" value={cc.text} onChange={(e) => cc.setText(e.target.value)} placeholder="অথবা লিখুন — কমা দিয়ে আলাদা করুন" aria-label="অভিযোগ" />
            <div className="rw-h" style={{ marginTop: 6 }}><h3>রোগ নির্ণয় (D/E)</h3></div>
            <Chips list={[...new Set([...dx.items, ...habits.diagnoses])]} has={dx.has} toggle={dx.toggle} />
            <input className="input rw-free" value={dx.text} onChange={(e) => dx.setText(e.target.value)} placeholder="অথবা লিখুন" aria-label="রোগ নির্ণয়" />
          </section>

          <section className="rw-card rw-rx">
            <div className="rw-h"><h3><span className="rw-rxmark">℞</span> ওষুধ</h3><small>{meds.length ? `${bnD(String(meds.length))}টি` : ""}</small></div>
            <div className="rw-tpls">
              {templates.map((t) => (
                <span key={t.id} className="rw-tpl">
                  <button type="button" onClick={() => applyTpl(t)}>★ {t.name}</button>
                  <button type="button" className="x" aria-label={`${t.name} মুছুন`} title="টেমপ্লেট মুছুন" onClick={async () => { await deleteRxTemplate(t.id); setTemplates((ts) => ts.filter((x) => x.id !== t.id)); }}>×</button>
                </span>
              ))}
              {tplName === null
                ? <button type="button" className="rw-tpl-add" disabled={!filled} title={filled ? "" : "আগে কিছু লিখুন"} onClick={() => setTplName("")}>+ এই লেখাটা টেমপ্লেট করুন</button>
                : <span className="rw-tpl-new"><input autoFocus className="input" value={tplName} maxLength={40} placeholder="নাম, যেমন: উচ্চ রক্তচাপ — পুরনো" onChange={(e) => setTplName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveTpl(); } if (e.key === "Escape") setTplName(null); }} /><button type="button" className="btn btn-primary" onClick={saveTpl}>রাখুন</button><button type="button" className="btn" onClick={() => setTplName(null)}>বাদ</button></span>}
            </div>

            <div className="rw-search">
              <Icon name="search" size={20} />
              <input ref={searchRef} value={q} placeholder="ওষুধের নাম লিখুন… (Ctrl + K)" aria-label="ওষুধ খুঁজুন" autoComplete="off"
                onChange={(e) => { setQ(e.target.value); setHi(0); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, matches.length)); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
                  else if (e.key === "Enter") { e.preventDefault(); pick(hi < matches.length ? matches[hi] : null); }
                  else if (e.key === "Escape") setQ("");
                }} />
              {q && <kbd>Enter</kbd>}
            </div>
            {q.trim() && (
              <ul className="rw-dd" role="listbox">
                {matches.map((m, i) => (
                  <li key={m.name} role="option" aria-selected={i === hi} className={i === hi ? "on" : ""} onMouseDown={(e) => { e.preventDefault(); pick(m); }} onMouseEnter={() => setHi(i)}>
                    <b>{m.name}</b>{(m.dose || m.days) && <small>আপনি সাধারণত: {[m.dose, m.when, m.days].filter(Boolean).join(" · ")}</small>}
                  </li>
                ))}
                <li role="option" aria-selected={hi === matches.length} className={`new${hi === matches.length ? " on" : ""}`} onMouseDown={(e) => { e.preventDefault(); pick(null); }} onMouseEnter={() => setHi(matches.length)}>
                  <b>+ &quot;{q.trim()}&quot; নতুন ওষুধ হিসেবে লিখুন</b>
                </li>
              </ul>
            )}

            {meds.length === 0 && <p className="rw-none">উপরে নাম লিখে Enter চাপুন, অথবা টেমপ্লেট / &quot;সব আবার লিখুন&quot; চাপুন।</p>}
            <ol className="rw-meds">
              {meds.map((m, i) => {
                const al = allergyHit(m.name, pt.allergies);
                const row = (k: "dose" | "when" | "days", label: string, opts: string[]) => {
                  const custom = openCustom[`${i}${k}`] || (m[k] && !opts.includes(m[k]));
                  return (
                    <div className="rw-row"><span className="rw-rl">{label}</span>
                      <div className="rw-chips">
                        {opts.map((o) => <button type="button" key={o} className={`rw-chip${m[k] === o ? " on" : ""}`} aria-pressed={m[k] === o} onClick={() => upd(i, k, m[k] === o ? "" : o)}>{o}</button>)}
                        {custom ? <input className="input rw-cin" value={m[k]} autoFocus={openCustom[`${i}${k}`]} onChange={(e) => upd(i, k, e.target.value)} placeholder="লিখুন" aria-label={label} />
                          : <button type="button" className="rw-chip ghost" onClick={() => setOpenCustom((o) => ({ ...o, [`${i}${k}`]: true }))}>অন্য…</button>}
                      </div>
                    </div>
                  );
                };
                return (
                  <li key={i} className={`rw-med${al ? " bad" : ""}`}>
                    <div className="rw-mh">
                      <span className="rw-n">{bnD(String(i + 1))}</span>
                      <input className="rw-mname" value={m.name} onChange={(e) => upd(i, "name", e.target.value)} aria-label="ওষুধের নাম" />
                      <span className="rw-mbtns">
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="উপরে নিন"><Icon name="up" size={16} /></button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === meds.length - 1} aria-label="নিচে নিন"><Icon name="down" size={16} /></button>
                        <button type="button" onClick={() => setMeds((x) => x.filter((_, j) => j !== i))} aria-label="বাদ দিন"><Icon name="x" size={16} /></button>
                      </span>
                    </div>
                    {al && <p className="rw-warn"><Icon name="alert" size={15} />সাবধান — রোগীর &quot;{al}&quot;-এ অ্যালার্জি আছে</p>}
                    {row("dose", "ডোজ", DOSES)}
                    {row("when", "কখন", WHENS)}
                    {row("days", "কত দিন", DAYS)}
                  </li>
                );
              })}
            </ol>
            {warns.length > 0 && <p className="rw-warn big"><Icon name="alert" size={17} />{bnD(String(warns.length))}টি ওষুধ রোগীর অ্যালার্জির সাথে মিলতে পারে — দেখে নিন</p>}
          </section>

          <section className="rw-card">
            <div className="rw-h"><h3>পরীক্ষা (Investigation)</h3></div>
            <Chips list={[...new Set([...inv.items, ...habits.tests])]} has={inv.has} toggle={inv.toggle} />
            <input className="input rw-free" value={inv.text} onChange={(e) => inv.setText(e.target.value)} placeholder="অথবা লিখুন — কমা দিয়ে আলাদা" aria-label="পরীক্ষা" />
            <div className="rw-h" style={{ marginTop: 6 }}><h3>পরামর্শ</h3></div>
            <Chips list={[...new Set([...adv.items, ...habits.advice])]} has={adv.has} toggle={adv.toggle} />
            <textarea className="input rw-free" rows={2} value={adv.text} onChange={(e) => adv.setText(e.target.value)} placeholder="অথবা লিখুন — প্রতি লাইনে একটা" aria-label="পরামর্শ" />
            <div className="rw-h" style={{ marginTop: 6 }}><h3>আবার দেখাবেন</h3></div>
            <div className="rw-chips rw-fu">
              {FU.map(([v, l]) => <button type="button" key={v} className={`rw-chip${fu === v ? " on" : ""}`} aria-pressed={fu === v} onClick={() => setFu(v)}>{l}</button>)}
              {fu === "date" && <input className="input rw-cin" type="date" min={P.minDate} value={fuDate} onChange={(e) => setFuDate(e.target.value)} required aria-label="ফলোআপের তারিখ" />}
            </div>
            <small className="muted">{fu ? "আগের দিন রোগীর কাছে বুকিং লিংকসহ রিমাইন্ডার যাবে।" : "কোনো রিমাইন্ডার যাবে না।"}</small>
          </section>

          <p className="rw-keys"><kbd>Ctrl</kbd>+<kbd>K</kbd> ওষুধ খুঁজুন · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> সেভ করে পরের রোগী · <kbd>Ctrl</kbd>+<kbd>S</kbd> সেভ · <kbd>Ctrl</kbd>+<kbd>P</kbd> প্রিন্ট</p>
        </div>

        {/* ---------- ৭. ডানে লাইভ প্যাড ---------- */}
        <aside className="rw-pv"><div className="rw-pv-in"><div className="rw-h"><h3>প্যাডের প্রিভিউ</h3><small>{P.chamberName}</small></div>{padBox}</div></aside>
      </div>

      {/* মোবাইলে নিচের বার */}
      <div className="rw-bar">
        <button type="button" className="btn" onClick={() => setPreview(true)}><Icon name="layout" size={17} />প্যাড</button>
        <button className="btn btn-primary" name="next" value="1" disabled={pending}>{pending ? "সেভ হচ্ছে…" : "সেভ করে পরের রোগী →"}</button>
      </div>

      {preview && (
        <div className="rw-modal" role="dialog" aria-modal="true" aria-label="প্যাডের প্রিভিউ" onClick={() => setPreview(false)}>
          <div className="rw-modal-in" onClick={(e) => e.stopPropagation()}>
            <div className="rw-h"><h3>প্যাডের প্রিভিউ</h3><button type="button" className="btn" onClick={() => setPreview(false)}><Icon name="x" size={18} />বন্ধ</button></div>
            {padBox}
          </div>
        </div>
      )}
    </form>
  );
}
