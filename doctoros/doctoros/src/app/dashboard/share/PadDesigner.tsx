"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import { RxPad } from "@/components/RxPad";
import { COLORS, type ColorId, nearestColor, type PadData, type PadSections, type PadSettings, TEMPLATES } from "@/lib/rxpad";
import { type AssetKind, removeAsset, saveAsset, savePad } from "./actions";

/** PDF-এর প্রথম পাতাকে ছবিতে বদলানো (ব্রাউজারেই, সার্ভারে PDF যায় না) */
async function pdfToImage(file: File): Promise<File> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const page = await doc.getPage(1);
  const v1 = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: Math.min(4, 1800 / v1.width) });
  const c = document.createElement("canvas");
  c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  doc.destroy();
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("pdf"))), "image/png"));
  return new File([blob], "page.png", { type: "image/png" });
}

/** সাদা কাগজের পটভূমি সরিয়ে স্বচ্ছ করা — স্বাক্ষর/সিল প্যাডের উপর সুন্দর বসে */
function clearWhite(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const im = ctx.getImageData(0, 0, w, h); const px = im.data;
  for (let i = 0; i < px.length; i += 4) {
    const l = (px[i] + px[i + 1] + px[i + 2]) / 3;
    const sat = Math.max(px[i], px[i + 1], px[i + 2]) - Math.min(px[i], px[i + 1], px[i + 2]);
    if (l > 215 && sat < 40) px[i + 3] = 0; // প্রায় সাদা → পুরো স্বচ্ছ
    else if (l > 170 && sat < 40) px[i + 3] = Math.round(px[i + 3] * (215 - l) / 45); // কিনারা নরম
  }
  ctx.putImageData(im, 0, 0);
}

/** ছবি ব্রাউজারেই ছোট করা — লোগো PNG থাকলে স্বচ্ছ পটভূমি রেখে দিই */
async function shrink(file: File, maxW: number, maxH: number, png: boolean, transparent = false) {
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const k = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  const ctx = c.getContext("2d")!;
  if (!png) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  if (transparent) clearWhite(ctx, c.width, c.height);
  // লোগোর প্রধান রং (সাদা/কালো/ধূসর বাদে)
  let color: string | null = null;
  try {
    const px = ctx.getImageData(0, 0, c.width, c.height).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < px.length; i += 16) {
      const [R, G, B, A] = [px[i], px[i + 1], px[i + 2], px[i + 3]];
      if (A < 128) continue;
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
      if (mx - mn < 40 || mx > 245 || mx < 30) continue;
      r += R; g += G; b += B; n++;
    }
    if (n > 20) color = "#" + [r, g, b].map((x) => Math.round(x / n).toString(16).padStart(2, "0")).join("");
  } catch { /* ignore */ }
  const type = png ? "image/png" : "image/jpeg";
  let url = c.toDataURL(type, 0.85);
  if (!png && url.length > 2_400_000) url = c.toDataURL(type, 0.7);
  return { url, w: c.width, h: c.height, color };
}

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

export function PadDesigner({ initial, sample: sample0 }: { initial: PadSettings; sample: PadData }) {
  const [p, setP] = useState(initial);
  const [logoUrl, setLogoUrl] = useState(sample0.logoUrl ?? null);
  const [padUrl, setPadUrl] = useState(sample0.padUrl ?? null);
  const [signUrl, setSignUrl] = useState(sample0.signUrl ?? null);
  const [sealUrl, setSealUrl] = useState(sample0.sealUrl ?? null);
  const [upMsg, setUpMsg] = useState<{ k: AssetKind; t: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState<"" | AssetKind>("");
  const sample = { ...sample0, logoUrl, padUrl, signUrl, sealUrl };
  async function upload(kind: AssetKind, file0: File | undefined) {
    if (!file0) return;
    const isPdf = file0.type === "application/pdf" || /\.pdf$/i.test(file0.name);
    if (!isPdf && !file0.type.startsWith("image/")) { setUpMsg({ k: kind, t: "JPG, PNG ছবি বা PDF দিন", err: true }); return; }
    setBusy(kind); setUpMsg(null);
    try {
      let file = file0;
      if (isPdf) {
        try { file = await pdfToImage(file0); }
        catch { setUpMsg({ k: kind, t: "PDF-টা খোলা যায়নি — পাসওয়ার্ড দেওয়া থাকলে সরিয়ে দিন, অথবা ছবি দিন", err: true }); return; }
      }
      if (kind === "sign" || kind === "seal") {
        const r = await shrink(file, kind === "sign" ? 700 : 500, kind === "sign" ? 350 : 500, true, true);
        const res = await saveAsset(kind, r.url, r.w, r.h);
        if (res.error) { setUpMsg({ k: kind, t: res.error, err: true }); return; }
        (kind === "sign" ? setSignUrl : setSealUrl)(r.url);
        if (!p.sections.signature) { setP((x) => ({ ...x, sections: { ...x.sections, signature: true } })); setDirty(true); }
        setUpMsg({ k: kind, t: `${kind === "sign" ? "স্বাক্ষর" : "সিল"} বসে গেছে — সাদা পটভূমি সরিয়ে দেওয়া হয়েছে। প্রতিটা প্রেসক্রিপশনে নিজে থেকেই বসবে।` });
        return;
      }
      const r = kind === "logo" ? await shrink(file, 600, 600, file.type === "image/png") : await shrink(file, 1600, 2300, false);
      const res = await saveAsset(kind, r.url, r.w, r.h);
      if (res.error) { setUpMsg({ k: kind, t: res.error, err: true }); return; }
      if (kind === "logo") {
        setLogoUrl(r.url);
        const nc = r.color ? nearestColor(r.color) : null;
        if (nc && nc !== p.color) { setP((x) => ({ ...x, color: nc, showLogo: true })); setDirty(true); setUpMsg({ k: kind, t: `লোগো বসে গেছে। লোগোর সাথে মিলিয়ে রং "${COLORS[nc].name}" করা হলো — পছন্দ না হলে নিচে বদলান, তারপর সেভ করুন।` }); }
        else { setP((x) => ({ ...x, showLogo: true })); setUpMsg({ k: kind, t: "লোগো বসে গেছে — সব ফরম্যাটে দেখাবে" }); }
      } else {
        setPadUrl(r.url);
        setP((x) => ({ ...x, template: "custom" })); setDirty(true);
        // A4/A5 কাগজের অনুপাত ১.৪১ — ছবি এর থেকে অনেক আলাদা হলে সতর্ক করি
        const ratio = r.h / r.w;
        if (Math.abs(ratio - 1.414) > 0.1) { setUpMsg({ k: kind, t: "প্যাড আপলোড হয়েছে, তবে ছবির মাপ কাগজের মতো লম্বা নয় — প্রিন্টে টেনে লম্বা হতে পারে। ছবি থেকে শুধু প্যাডের অংশটুকু কেটে (crop) আবার দিন, অথবা স্ক্যান করা ছবি দিন।", err: true }); return; }
        setUpMsg({ k: kind, t: "প্যাড আপলোড হয়েছে, \"আমার প্যাড\" বাছা হলো। লেখা কোথায় বসবে নিচে মিমিতে ঠিক করুন, তারপর \"ডিজাইন সেভ করুন\"।" });
      }
    } catch { setUpMsg({ k: kind, t: "ছবিটা খোলা যায়নি, অন্য ছবি দিন", err: true }); }
    finally { setBusy(""); }
  }
  async function remove(kind: AssetKind) {
    await removeAsset(kind);
    if (kind === "sign") setSignUrl(null); else if (kind === "seal") setSealUrl(null); else if (kind === "logo") setLogoUrl(null); else { setPadUrl(null); if (p.template === "custom") { setP((x) => ({ ...x, template: "teal" })); setDirty(true); } }
    setUpMsg({ k: kind, t: "সরানো হয়েছে" });
  }
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
          <h3 className="pd-h">লোগো, নিজের প্যাড, স্বাক্ষর ও সিল (ঐচ্ছিক)</h3>
          <div className="pd-ups">
            <div className="pd-up">
              <div className="pd-up-box logo">{logoUrl ? <img src={logoUrl} alt="লোগো" /> : <Icon name="camera" size={28} />}</div>
              <div className="col" style={{ gap: 6, minWidth: 0 }}>
                <b>লোগো</b>
                <span className="small muted">আপলোড করলেই সব ফরম্যাটে লোগো বসে যাবে, রংও লোগোর সাথে মিলিয়ে নেওয়া হবে। স্বচ্ছ পটভূমির PNG সবচেয়ে ভালো।</span>
                <div className="row" style={{ gap: 6 }}>
                  <label className="btn btn-sm2 pd-file">{busy === "logo" ? "আপলোড হচ্ছে…" : logoUrl ? "লোগো বদলান" : "লোগো আপলোড"}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { upload("logo", e.target.files?.[0]); e.target.value = ""; }} /></label>
                  {logoUrl && <button type="button" className="btn btn-sm2" onClick={() => remove("logo")}>সরান</button>}
                </div>
                {logoUrl && <label className="pd-inline"><input type="checkbox" checked={p.showLogo} onChange={(e) => up({ showLogo: e.target.checked })} />প্যাডে লোগো দেখাবে</label>}
                {upMsg?.k === "logo" && <span className={`small ${upMsg.err ? "pd-err" : "pd-ok"}`}>{upMsg.t}</span>}
              </div>
            </div>
            <div className="pd-up">
              <div className="pd-up-box pad">{padUrl ? <img src={padUrl} alt="নিজের প্যাড" /> : <Icon name="layout" size={28} />}</div>
              <div className="col" style={{ gap: 6, minWidth: 0 }}>
                <b>নিজের প্যাড</b>
                <span className="small muted">প্রেস থেকে পাওয়া প্যাডের <b>PDF</b> দিন, অথবা ছবি (স্ক্যান করা বা সোজা করে তোলা, চারপাশ কেটে)। PDF-এর প্রথম পাতা নেওয়া হবে। সাদা কাগজেই পুরো প্যাডসহ প্রেসক্রিপশন প্রিন্ট হবে।</span>
                <div className="row" style={{ gap: 6 }}>
                  <label className="btn btn-sm2 pd-file">{busy === "pad" ? "আপলোড হচ্ছে…" : padUrl ? "প্যাড বদলান" : "প্যাড আপলোড"}<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf,.pdf" hidden onChange={(e) => { upload("pad", e.target.files?.[0]); e.target.value = ""; }} /></label>
                  {padUrl && <button type="button" className="btn btn-sm2" onClick={() => remove("pad")}>সরান</button>}
                </div>
                {upMsg?.k === "pad" && <span className={`small ${upMsg.err ? "pd-err" : "pd-ok"}`}>{upMsg.t}</span>}
              </div>
            </div>
            {([["sign", "স্বাক্ষর", signUrl, "সাদা কাগজে কালো/নীল কালিতে সই করে ছবি তুলুন (কাছ থেকে, আলোয়)। সাদা অংশ নিজে থেকেই সরে যাবে।"], ["seal", "সিল", sealUrl, "সাদা কাগজে সিল মেরে ছবি তুলুন — স্বাক্ষরের পাশে বসবে।"]] as const).map(([k, label, url, help]) => (
              <div key={k} className="pd-up">
                <div className={`pd-up-box ${k}`}>{url ? <img src={url} alt={label} /> : <Icon name="edit" size={26} />}</div>
                <div className="col" style={{ gap: 6, minWidth: 0 }}>
                  <b>{label}</b>
                  <span className="small muted">{help}</span>
                  <div className="row" style={{ gap: 6 }}>
                    <label className="btn btn-sm2 pd-file">{busy === k ? "আপলোড হচ্ছে…" : url ? `${label} বদলান` : `${label} আপলোড`}<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf,.pdf" hidden onChange={(e) => { upload(k, e.target.files?.[0]); e.target.value = ""; }} /></label>
                    {url && <button type="button" className="btn btn-sm2" onClick={() => remove(k)}>সরান</button>}
                  </div>
                  {upMsg?.k === k && <span className={`small ${upMsg.err ? "pd-err" : "pd-ok"}`}>{upMsg.t}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card stack-sm">
          <h3 className="pd-h">১. ফরম্যাট বাছুন</h3>
          <div className="pd-tpls" role="radiogroup" aria-label="ফরম্যাট">
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={p.template === t.id} className={`pd-tpl${p.template === t.id ? " on" : ""}`}
                onClick={() => { if (t.id === "custom" && !padUrl) { setUpMsg({ k: "pad", t: "আগে উপরে \"প্যাড আপলোড\" চাপুন", err: true }); return; } up({ template: t.id }); }}>
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
          {p.template === "custom" && (
            <div className="grid">
              {([["topMm", "উপরে ফাঁকা", 120], ["bottomMm", "নিচে ফাঁকা", 80], ["leftMm", "বামে ফাঁকা", 60], ["rightMm", "ডানে ফাঁকা", 60]] as const).map(([k, l, mx]) => (
                <label key={k} className="field">{l} (মিমি)<input className="input" type="number" min={0} max={mx} value={p[k]} onChange={(e) => up({ [k]: Math.max(0, Math.min(mx, Number(e.target.value) || 0)) } as Partial<PadSettings>)} /></label>
              ))}
              <span className="small muted" style={{ gridColumn: "1 / -1" }}>প্রিভিউতে কমলা দাগের ভেতরে লেখা বসবে — প্যাডের হেডার আর ফুটার যেন দাগের বাইরে থাকে।</span>
            </div>
          )}
          {p.template === "preprinted" && (
            <div className="grid">
              <label className="field">উপরে ফাঁকা (মিমি)<input className="input" type="number" min={0} max={120} value={p.topMm} onChange={(e) => up({ topMm: Math.max(0, Math.min(120, Number(e.target.value) || 0)) })} /><span className="small muted">আপনার প্যাডের হেডার যতটুকু জায়গা নেয়</span></label>
              <label className="field">নিচে ফাঁকা (মিমি)<input className="input" type="number" min={0} max={80} value={p.bottomMm} onChange={(e) => up({ bottomMm: Math.max(0, Math.min(80, Number(e.target.value) || 0)) })} /></label>
            </div>
          )}
        </section>

        {p.template !== "preprinted" && p.template !== "custom" && (
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
          <h3 className="pd-h">{p.template === "preprinted" || p.template === "custom" ? "৩" : "৪"}. কোন অংশ থাকবে</h3>
          <div className="pd-checks">
            <span className="pd-always">সবসময় থাকে: ডাক্তারের নাম ও ডিগ্রি · রোগীর তথ্য · অভিযোগ (C/C) · রোগ নির্ণয় (D/E) · ওষুধ (Rx)</span>
            {(Object.keys(SECTION_LABEL) as (keyof PadSections)[]).filter((k) => (p.template !== "preprinted" && p.template !== "custom") || !["qr", "watermark"].includes(k) && (k !== "signature" || signUrl || sealUrl)).map((k) => (
              <label key={k}><input type="checkbox" checked={p.sections[k]} onChange={(e) => sec(k, e.target.checked)} />{k === "signature" && (signUrl || sealUrl) ? "স্বাক্ষর ও সিল (আপলোড করা ছবি)" : SECTION_LABEL[k]}</label>
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
