"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import { RxPad } from "@/components/RxPad";
import { COLORS, type ColorId, type PadData, type PadSections, type PadSettings, TEMPLATES } from "@/lib/rxpad";
import { savePad } from "./actions";

const SECTION_LABEL: Record<keyof PadSections, string> = {
  vitals: "শারীরিক মাপ (BP, পালস, ওজন, তাপ, SpO₂)", investigation: "পরীক্ষা (Investigation)", advice: "পরামর্শ",
  followup: "পরবর্তী সাক্ষাৎ", qr: "QR কোড (পরের সিরিয়ালের জন্য)", signature: "স্বাক্ষর ও সিলের জায়গা", watermark: "হালকা স্টেথোস্কোপ জলছাপ",
};
const MM = 3.7795; // ১ মিমি ≈ ৩.৭৮ px

/** প্যাডকে বাক্সের মাপে ছোট করে দেখানো (আসল মাপ মিমিতে) */
function Scaled({ s, d, maxW }: { s: PadSettings; d: PadData; maxW?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(maxW ?? 360);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pw = (s.paper === "A5" ? 148 : 210) * MM, ph = (s.paper === "A5" ? 210 : 297) * MM;
  const k = w / pw;
  return (
    <div ref={ref} className="pd-scaled" style={{ height: ph * k }}>
      <div style={{ transform: `scale(${k})`, transformOrigin: "0 0", width: pw }}><RxPad s={s} d={d} /></div>
    </div>
  );
}

export function PadDesigner({ initial, sample }: { initial: PadSettings; sample: PadData }) {
  const [p, setP] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [state, act, pending] = useActionState(savePad, undefined);
  useEffect(() => { if (state?.ok) setDirty(false); }, [state?.at, state?.ok]);
  const up = (patch: Partial<PadSettings>) => { setP((x) => ({ ...x, ...patch })); setDirty(true); };
  const sec = (k: keyof PadSections, v: boolean) => { setP((x) => ({ ...x, sections: { ...x.sections, [k]: v } })); setDirty(true); };
  const text = (k: "hospital" | "slogan" | "phone" | "website" | "email", label: string, ph: string) => (
    <label className="field">{label}<input className="input" value={p[k]} maxLength={k === "slogan" ? 120 : 80} placeholder={ph} onChange={(e) => up({ [k]: e.target.value } as Partial<PadSettings>)} /></label>
  );

  return (
    <form action={act} className="pd">
      <input type="hidden" name="pad" value={JSON.stringify(p)} />
      <div className="pd-left">
        <section className="card stack-sm">
          <h3 className="pd-h">১. ফরম্যাট বাছুন</h3>
          <div className="pd-tpls" role="radiogroup" aria-label="ফরম্যাট">
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={p.template === t.id} className={`pd-tpl${p.template === t.id ? " on" : ""}`} onClick={() => up({ template: t.id })}>
                <div className="pd-thumb" aria-hidden><Scaled s={{ ...p, template: t.id, paper: "A4" }} d={sample} maxW={150} /></div>
                <b>{t.name}</b><small>{t.desc}</small>
                {p.template === t.id && <span className="pd-tick"><Icon name="check" size={16} stroke={3} /></span>}
              </button>
            ))}
          </div>
        </section>

        <section className="card stack-sm">
          <h3 className="pd-h">২. রং, কাগজ ও ভাষা</h3>
          {p.template !== "preprinted" && (
            <div className="pd-colors" role="radiogroup" aria-label="রং">
              {(Object.keys(COLORS) as ColorId[]).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={p.color === k} className={`pd-color${p.color === k ? " on" : ""}`} onClick={() => up({ color: k })}>
                  <span><i style={{ background: COLORS[k].a }} /><i style={{ background: COLORS[k].b }} /></span>{COLORS[k].name}
                </button>
              ))}
            </div>
          )}
          <div className="pd-row">
            <div className="pd-seg" role="radiogroup" aria-label="কাগজ">
              {(["A4", "A5"] as const).map((x) => <button key={x} type="button" className={p.paper === x ? "on" : ""} aria-checked={p.paper === x} role="radio" onClick={() => up({ paper: x })}>{x}{x === "A5" ? " (ছোট)" : ""}</button>)}
            </div>
            <div className="pd-seg" role="radiogroup" aria-label="লেবেলের ভাষা">
              {([["bn", "বাংলা লেবেল"], ["en", "English লেবেল"]] as const).map(([x, l]) => <button key={x} type="button" className={p.labels === x ? "on" : ""} aria-checked={p.labels === x} role="radio" onClick={() => up({ labels: x })}>{l}</button>)}
            </div>
          </div>
          {p.template === "preprinted" && (
            <div className="grid">
              <label className="field">উপরে ফাঁকা (মিমি)<input className="input" type="number" min={0} max={120} value={p.topMm} onChange={(e) => up({ topMm: Math.max(0, Math.min(120, Number(e.target.value) || 0)) })} /><span className="small muted">আপনার প্যাডের হেডার যতটুকু জায়গা নেয়</span></label>
              <label className="field">নিচে ফাঁকা (মিমি)<input className="input" type="number" min={0} max={80} value={p.bottomMm} onChange={(e) => up({ bottomMm: Math.max(0, Math.min(80, Number(e.target.value) || 0)) })} /></label>
            </div>
          )}
        </section>

        {p.template !== "preprinted" && (
          <section className="card stack-sm">
            <h3 className="pd-h">৩. চেম্বার ও যোগাযোগ</h3>
            <div className="grid">
              {text("hospital", "হাসপাতাল / চেম্বারের নাম", "খালি রাখলে চেম্বারের নাম বসবে")}
              {text("slogan", "স্লোগান (ঐচ্ছিক)", "যেমন: যত্নই আমাদের অঙ্গীকার")}
              {text("phone", "ফোন / সিরিয়ালের নম্বর", "০১৭XXXXXXXX")}
              {text("website", "ওয়েবসাইট (ঐচ্ছিক)", "খালি রাখলে আপনার প্রোফাইল লিংক")}
              {text("email", "ইমেইল (ঐচ্ছিক)", "dr.name@gmail.com")}
            </div>
          </section>
        )}

        <section className="card stack-sm">
          <h3 className="pd-h">{p.template === "preprinted" ? "৩" : "৪"}. কোন অংশ থাকবে</h3>
          <div className="pd-checks">
            <span className="pd-always">সবসময় থাকে: ডাক্তারের নাম ও ডিগ্রি · রোগীর তথ্য · অভিযোগ (C/C) · রোগ নির্ণয় (D/E) · ওষুধ (Rx)</span>
            {(Object.keys(SECTION_LABEL) as (keyof PadSections)[]).filter((k) => p.template !== "preprinted" || !["qr", "signature", "watermark"].includes(k)).map((k) => (
              <label key={k}><input type="checkbox" checked={p.sections[k]} onChange={(e) => sec(k, e.target.checked)} />{SECTION_LABEL[k]}</label>
            ))}
          </div>
        </section>
      </div>

      <div className="pd-right">
        <div className="pd-pv-h"><b>প্রিভিউ</b><span className="small muted">নমুনা রোগী দিয়ে দেখানো</span></div>
        <div className="pd-pv"><Scaled s={p} d={sample} /></div>
        <div className="pd-save">
          <span className="small" aria-live="polite">{state?.error ? <span style={{ color: "var(--red)" }}>⚠ {state.error}</span> : state?.ok && !dirty ? <span style={{ color: "var(--teal-ink)" }}>✓ {state.ok}</span> : dirty ? "সেভ করা হয়নি" : ""}</span>
          <a className="btn" href="/print/rx-sample" target="_blank" rel="noreferrer"><Icon name="external" size={16} />নমুনা প্রিন্ট</a>
          <button className="btn btn-primary" disabled={pending}>{pending ? "সেভ হচ্ছে…" : "ডিজাইন সেভ করুন"}</button>
        </div>
      </div>
    </form>
  );
}
