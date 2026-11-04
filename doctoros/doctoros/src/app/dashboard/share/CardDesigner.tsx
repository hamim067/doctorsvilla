"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import { VisitingCard } from "@/components/VisitingCard";
import { COLORS, type ColorId } from "@/lib/rxpad";
import { CARD_TEMPLATES, type CardData, type CardFields, type CardSettings } from "@/lib/vcard";
import { saveCard } from "./actions";
import { Step } from "./Step";

const W = 85 * 3.7795, H = 55 * 3.7795; // কার্ডের আসল মাপ px-এ
const FIELD_LABEL: Record<keyof CardFields, string> = {
  degrees: "ডিগ্রি", specialty: "বিশেষজ্ঞতা", bmdc: "BMDC নম্বর", phone: "ফোন নম্বর",
  chamber: "চেম্বারের নাম ও এলাকা", schedule: "রোগী দেখার সময়", website: "ওয়েবসাইট", qr: "QR কোড",
};
type Contact = { phone: string; website: string; email: string; hospital: string };

/** কার্ডকে বাক্সের মাপে ছোট/বড় করে দেখানো */
function Fit({ s, d, side }: { s: CardSettings; d: CardData; side?: "front" | "back" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(300);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const k = w / W;
  return (
    <div ref={ref} className="cd-fit" style={{ height: H * k }}>
      <div style={{ transform: `scale(${k})`, transformOrigin: "0 0", width: W }}><VisitingCard s={s} d={d} side={side} /></div>
    </div>
  );
}

export function CardDesigner({ initial, data, contact: c0 }: { initial: CardSettings; data: CardData; contact: Contact }) {
  const [s, setS] = useState(initial);
  const [c, setC] = useState(c0);
  const [dirty, setDirty] = useState(false);
  const [state, act, pending] = useActionState(saveCard, undefined);
  useEffect(() => { if (state?.ok) setDirty(false); }, [state?.at, state?.ok]);
  const up = (p: Partial<CardSettings>) => { setS((x) => ({ ...x, ...p })); setDirty(true); };
  const fld = (k: keyof CardFields, v: boolean) => { setS((x) => ({ ...x, fields: { ...x.fields, [k]: v } })); setDirty(true); };
  const d: CardData = { ...data, phone: c.phone || data.phone, website: c.website, email: c.email, hospital: c.hospital };
  const [open, setOpen] = useState("tpl");
  const tog = (k: string) => setOpen((o) => (o === k ? "" : k));
  const onCount = (Object.keys(FIELD_LABEL) as (keyof CardFields)[]).filter((k) => s.fields[k]).length;
  const missing = [!d.phone && "ফোন নম্বর", d.chambers.length === 0 && "চেম্বার"].filter(Boolean) as string[];

  return (
    <form action={act} className="pd cd">
      <input type="hidden" name="card" value={JSON.stringify({ card: s, contact: c })} />
      <div className="pd-left">
        <Step n={1} title="কার্ডের ফরম্যাট" hint={CARD_TEMPLATES.find((t) => t.id === s.template)?.name} open={open === "tpl"} onToggle={() => tog("tpl")}>
          <div className="cd-tpls" role="radiogroup" aria-label="কার্ডের ফরম্যাট">
            {CARD_TEMPLATES.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={s.template === t.id} className={`pd-tpl${s.template === t.id ? " on" : ""}`} onClick={() => up({ template: t.id })}>
                <div className="cd-thumb" aria-hidden><Fit s={{ ...s, template: t.id }} d={d} /></div>
                <b>{t.name}</b><small>{t.desc}</small>
                {s.template === t.id && <span className="pd-tick"><Icon name="check" size={16} stroke={3} /></span>}
              </button>
            ))}
          </div>
        </Step>

        <Step n={2} title="রং" hint={COLORS[s.color].name} open={open === "color"} onToggle={() => tog("color")}>
          <div className="pd-colors" role="radiogroup" aria-label="রং">
            {(Object.keys(COLORS) as ColorId[]).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={s.color === k} className={`pd-color${s.color === k ? " on" : ""}`} onClick={() => up({ color: k })}>
                <span><i style={{ background: COLORS[k].a }} /><i style={{ background: COLORS[k].b }} /></span>{COLORS[k].name}
              </button>
            ))}
          </div>
        </Step>

        <Step n={3} title="কার্ডে কী কী থাকবে" hint={`${onCount}টি তথ্য${s.back ? " · পেছনের দিকসহ" : ""}`} open={open === "fields"} onToggle={() => tog("fields")}>
          <span className="pd-always">নাম, ডিগ্রি, চেম্বার আর সময় আপনার প্রোফাইল ও চেম্বার থেকে নিজে থেকেই আসে — আবার লিখতে হবে না।</span>
          <div className="pd-checks cd-checks">
            {(Object.keys(FIELD_LABEL) as (keyof CardFields)[]).map((k) => (
              <label key={k}><input type="checkbox" checked={s.fields[k]} onChange={(e) => fld(k, e.target.checked)} />{FIELD_LABEL[k]}</label>
            ))}
            {data.logoUrl && <label><input type="checkbox" checked={s.showLogo} onChange={(e) => up({ showLogo: e.target.checked })} />লোগো</label>}
            <label><input type="checkbox" checked={s.back} onChange={(e) => up({ back: e.target.checked })} />পেছনের দিক (সব চেম্বার, সময় ও বড় QR)</label>
          </div>
          {!data.logoUrl && <span className="small muted">লোগো দিতে চাইলে নিচের প্যাডের অংশে &quot;লোগো আপলোড&quot; করুন — কার্ডেও বসে যাবে।</span>}
        </Step>

        <Step n={4} title="ফোন, ওয়েবসাইট ও এক লাইনের কথা" hint={d.phone || "ফোন নম্বর দেওয়া নেই"} open={open === "contact"} onToggle={() => tog("contact")}>
          <div className="grid">
            <label className="field">ফোন / সিরিয়ালের নম্বর<input className="input" value={c.phone} maxLength={40} placeholder="০১৭XXXXXXXX" onChange={(e) => { setC({ ...c, phone: e.target.value }); setDirty(true); }} /></label>
            <label className="field">ওয়েবসাইট (ঐচ্ছিক)<input className="input" value={c.website} maxLength={80} placeholder="খালি রাখলে প্রোফাইল লিংক" onChange={(e) => { setC({ ...c, website: e.target.value }); setDirty(true); }} /></label>
            <label className="field">এক লাইনের কথা (ঐচ্ছিক)<input className="input" value={s.tagline} maxLength={60} placeholder="যেমন: হৃদরোগ ও মেডিসিন বিশেষজ্ঞ" onChange={(e) => up({ tagline: e.target.value })} /></label>
          </div>
          <span className="small muted">ফোন আর ওয়েবসাইট প্রেসক্রিপশন প্যাডের সাথে একই — এক জায়গায় বদলালে দুটোতেই বদলাবে।</span>
        </Step>
      </div>

      <div className="pd-right">
        <div className="pd-pv-h"><b>প্রিভিউ</b><span className="small muted">আসল মাপ ৮৫ × ৫৫ মিমি</span></div>
        {missing.length > 0 && <p className="alert alert-error small" style={{ margin: 0 }}>{missing.join(" ও ")} নেই — কার্ডে দেখাবে না।</p>}
        <div className="cd-pv"><Fit s={s} d={d} /></div>
        {s.back && <><span className="small muted">পেছনের দিক</span><div className="cd-pv"><Fit s={s} d={d} side="back" /></div></>}
        <div className="pd-save">
          <span className="small" aria-live="polite">{state?.error ? <span style={{ color: "var(--red)" }}>⚠ {state.error}</span> : state?.ok && !dirty ? <span style={{ color: "var(--teal-ink)" }}>✓ {state.ok}</span> : dirty ? "সেভ করা হয়নি — প্রিন্টের আগে সেভ করুন" : ""}</span>
          <button className="btn btn-primary" disabled={pending}>{pending ? "সেভ হচ্ছে…" : "কার্ড সেভ করুন"}</button>
          <a className={`btn${dirty ? " disabled" : ""}`} href="/print/card" target="_blank" rel="noreferrer" aria-disabled={dirty} onClick={(e) => { if (dirty) e.preventDefault(); }}><Icon name="external" size={16} />প্রিন্ট (১০টি)</a>
        </div>
      </div>
    </form>
  );
}
