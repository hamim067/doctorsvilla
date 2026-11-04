"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import { keepValues } from "@/components/keepValues";

/** রিডিং — সার্ভার থেকে আসা সাধারণ রূপ (lib/vitals → toRow) */
export type VRow = { id: string; date: string; sys: number | null; dia: number | null; pulse: number | null; sugar: number | null; sugarWhen: string | null; weight: number | null; temp?: number | null; spo2?: number | null; note: string | null; by: string };
export type VState = { error?: string; ok?: string; at?: number } | undefined;

const bn = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
const MONTHS = ["জানু", "ফেব্রু", "মার্চ", "এপ্রি", "মে", "জুন", "জুলা", "আগ", "সেপ্টে", "অক্টো", "নভে", "ডিসে"];
const shortDate = (d: string) => `${bn(Number(d.slice(8)))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const WHEN: Record<string, string> = { fasting: "খালি পেটে", after_meal: "খাওয়ার ২ ঘণ্টা পর", random: "যেকোনো সময়" };

/** সাধারণ রেফারেন্স সীমা — শুধু রঙে বোঝানোর জন্য, রোগ নির্ণয় নয় */
function bpFlag(s: number, d: number) {
  if (s >= 140 || d >= 90) return { t: "বেশি", c: "hi" };
  if (s < 90 || d < 60) return { t: "কম", c: "lo" };
  return { t: "স্বাভাবিক সীমায়", c: "ok" };
}
function sugarFlag(v: number, when: string | null) {
  if (v < 3.9) return { t: "কম", c: "lo" };
  if ((when === "fasting" && v >= 7) || v >= 11.1) return { t: "বেশি", c: "hi" };
  return { t: "স্বাভাবিক সীমায়", c: "ok" };
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(300);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

type Series = { name: string; color: string; values: (number | null)[] };

/** এক বা একাধিক লাইনের ছোট চার্ট — তারিখ অনুযায়ী (পুরনো → নতুন) */
function LineChart({ dates, series, unit, band }: { dates: string[]; series: Series[]; unit: string; band?: [number, number] }) {
  const [ref, W] = useWidth();
  const H = 200, L = 40, R = 14, T = 14, B = 26;
  const [hover, setHover] = useState<number | null>(null);
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  if (!all.length) return <p className="vt-empty">এখনো কোনো রিডিং নেই</p>;
  let lo = Math.min(...all, ...(band ?? [])), hi = Math.max(...all, ...(band ?? []));
  const pad = Math.max(2, (hi - lo) * 0.15);
  lo = Math.max(0, Math.floor(lo - pad)); hi = Math.ceil(hi + pad);
  const n = dates.length;
  const x = (i: number) => (n === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + ((hi - v) * (H - T - B)) / (hi - lo || 1);
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const every = Math.max(1, Math.ceil(n / Math.floor((W - L) / 70)));
  return (
    <div ref={ref} className="vt-chart" onMouseLeave={() => setHover(null)}>
      <svg width={W} height={H} role="img" aria-label={`${series.map((s) => s.name).join(", ")} — ${n}টি রিডিং`}>
        {band && <rect x={L} width={W - L - R} y={y(band[1])} height={Math.max(0, y(band[0]) - y(band[1]))} fill="currentColor" opacity="0.06" />}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#E6EBE8" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="12" fill="#55635F">{bn(t)}</text>
          </g>
        ))}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v === null ? null : [x(i), y(v)] as const)).filter(Boolean) as (readonly [number, number])[];
          return (
            <g key={s.name}>
              {pts.length > 1 && <path d={pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ")} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
              {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill={s.color} stroke="#fff" strokeWidth="1.5" />)}
            </g>
          );
        })}
        {dates.map((d, i) => (i % every === 0 || i === n - 1) && <text key={d + i} x={x(i)} y={H - 7} textAnchor={i === 0 && n > 1 ? "start" : i === n - 1 && n > 1 ? "end" : "middle"} fontSize="12" fill="#55635F">{shortDate(d)}</text>)}
        {dates.map((d, i) => <rect key={`h${i}`} x={x(i) - (W - L - R) / Math.max(1, n - 1) / 2} y={T} width={(W - L - R) / Math.max(1, n - 1)} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />)}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="#C9D3CF" />}
      </svg>
      {hover !== null && (
        <div className="vt-tip" style={{ left: Math.min(Math.max(x(hover), 70), W - 70) }}>
          <b>{shortDate(dates[hover])}</b>
          {series.map((s) => s.values[hover] !== null && <span key={s.name}><i style={{ background: s.color }} />{s.name}: {bn(String(s.values[hover]))} {unit}</span>)}
        </div>
      )}
      <div className="vt-legend">{series.map((s) => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}{band && <span><i className="band" />সাধারণ সীমা</span>}</div>
    </div>
  );
}

export function VitalsPanel({ rows, action, canAdd = true, compact = false, intro }: {
  rows: VRow[]; action?: (s: VState, fd: FormData) => Promise<VState>; canAdd?: boolean; compact?: boolean; intro?: string;
}) {
  const [tab, setTab] = useState<"bp" | "sugar" | "weight">("bp");
  const [open, setOpen] = useState(false);
  const [state, act, pending] = useActionState(action ?? (async () => undefined), undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) { formRef.current?.reset(); setOpen(false); } }, [state?.at, state?.ok]);

  const asc = [...rows].reverse();
  const bp = asc.filter((r) => r.sys !== null);
  const sg = asc.filter((r) => r.sugar !== null);
  const wt = asc.filter((r) => r.weight !== null);
  const lastBp = bp.at(-1), lastSg = sg.at(-1), lastWt = wt.at(-1), prevWt = wt.at(-2);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());

  return (
    <div className={`vt${compact ? " compact" : ""}`}>
      <div className="vt-tiles">
        <div className="vt-tile">
          <span className="vt-tl"><Icon name="heart" size={16} />প্রেসার</span>
          {lastBp ? <><b>{bn(lastBp.sys!)}/{bn(lastBp.dia!)}<small> mmHg</small></b><span className={`vt-flag ${bpFlag(lastBp.sys!, lastBp.dia!).c}`}>{bpFlag(lastBp.sys!, lastBp.dia!).t}</span><span className="vt-d">{shortDate(lastBp.date)}</span></> : <span className="vt-none">এখনো নেই</span>}
        </div>
        <div className="vt-tile">
          <span className="vt-tl"><Icon name="drop" size={16} />সুগার</span>
          {lastSg ? <><b>{bn(lastSg.sugar!)}<small> mmol/L</small></b><span className={`vt-flag ${sugarFlag(lastSg.sugar!, lastSg.sugarWhen).c}`}>{sugarFlag(lastSg.sugar!, lastSg.sugarWhen).t}</span><span className="vt-d">{shortDate(lastSg.date)} · {WHEN[lastSg.sugarWhen ?? "random"]}</span></> : <span className="vt-none">এখনো নেই</span>}
        </div>
        <div className="vt-tile">
          <span className="vt-tl"><Icon name="pulse" size={16} />ওজন</span>
          {lastWt ? <><b>{bn(lastWt.weight!)}<small> kg</small></b>{prevWt && <span className="vt-flag nt">{lastWt.weight! > prevWt.weight! ? "▲" : lastWt.weight! < prevWt.weight! ? "▼" : "="} {bn(Math.abs(Math.round((lastWt.weight! - prevWt.weight!) * 10) / 10))} kg</span>}<span className="vt-d">{shortDate(lastWt.date)}</span></> : <span className="vt-none">এখনো নেই</span>}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="vt-box">
          <div className="vt-tabs" role="tablist">
            {([["bp", "প্রেসার"], ["sugar", "সুগার"], ["weight", "ওজন"]] as const).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
          {tab === "bp" && <LineChart dates={bp.map((r) => r.date)} unit="mmHg" band={[60, 140]} series={[{ name: "উপরের (সিস্টোলিক)", color: "#C2551A", values: bp.map((r) => r.sys) }, { name: "নিচের (ডায়াস্টোলিক)", color: "#0E8A72", values: bp.map((r) => r.dia) }]} />}
          {tab === "sugar" && <LineChart dates={sg.map((r) => r.date)} unit="mmol/L" band={[3.9, 7.8]} series={[{ name: "সুগার", color: "#5E3F8F", values: sg.map((r) => r.sugar) }]} />}
          {tab === "weight" && <LineChart dates={wt.map((r) => r.date)} unit="kg" series={[{ name: "ওজন", color: "#2B5A8F", values: wt.map((r) => r.weight) }]} />}
        </div>
      )}

      {canAdd && action && (
        <div className="vt-add">
          {!open ? (
            <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><Icon name="plus" size={18} />নতুন রিডিং যোগ করুন</button>
          ) : (
            <form ref={formRef} className="vt-form" onSubmit={keepValues(act)}>
              {intro && <p className="small muted">{intro}</p>}
              <div className="vt-grid">
                <label className="field">তারিখ<input className="input" type="date" name="date" defaultValue={today} max={today} required /></label>
                <div className="field"><span>প্রেসার (mmHg)</span>
                  <div className="vt-bp"><input className="input" name="systolic" inputMode="numeric" placeholder="১২০" aria-label="উপরের" /><span>/</span><input className="input" name="diastolic" inputMode="numeric" placeholder="৮০" aria-label="নিচের" /></div>
                </div>
                <label className="field">পালস (মিনিটে)<input className="input" name="pulse" inputMode="numeric" placeholder="৭২" /></label>
                <label className="field">সুগার (mmol/L বা mg/dL)<input className="input" name="sugar" inputMode="decimal" placeholder="৬.৫" /></label>
                <label className="field">সুগার কখন মাপা<select className="input" name="sugarWhen" defaultValue="fasting"><option value="fasting">খালি পেটে</option><option value="after_meal">খাওয়ার ২ ঘণ্টা পর</option><option value="random">যেকোনো সময়</option></select></label>
                <label className="field">ওজন (kg)<input className="input" name="weight" inputMode="decimal" placeholder="৬৫" /></label>
                <label className="field">তাপমাত্রা (°F)<input className="input" name="temp" inputMode="decimal" placeholder="৯৮.৬" /></label>
                <label className="field">অক্সিজেন SpO₂ (%)<input className="input" name="spo2" inputMode="numeric" placeholder="৯৮" /></label>
              </div>
              <label className="field">নোট (ঐচ্ছিক)<input className="input" name="note" maxLength={200} placeholder="যেমন: ওষুধ খাওয়ার আগে মাপা" /></label>
              {state?.error && <p className="alert alert-error" role="alert">⚠ {state.error}</p>}
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-primary" disabled={pending}>{pending ? "সেভ হচ্ছে…" : "সেভ করুন"}</button>
                <button type="button" className="btn" onClick={() => setOpen(false)}>বাতিল</button>
              </div>
            </form>
          )}
          {state?.ok && !open && <p className="alert alert-ok" role="status">✓ {state.ok}</p>}
        </div>
      )}

      {!compact && rows.length > 0 && (
        <div className="table-wrap vt-table">
          <table>
            <thead><tr><th>তারিখ</th><th>প্রেসার</th><th>পালস</th><th>সুগার</th><th>ওজন</th><th>তাপ/SpO₂</th><th>যোগ করেছেন</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{shortDate(r.date)} {bn(r.date.slice(0, 4))}{r.note && <div className="xs muted">{r.note}</div>}</td>
                  <td>{r.sys !== null ? <span className={`vt-v ${bpFlag(r.sys, r.dia!).c}`}>{bn(r.sys)}/{bn(r.dia!)}</span> : "—"}</td>
                  <td>{r.pulse !== null ? bn(r.pulse) : "—"}</td>
                  <td>{r.sugar !== null ? <span className={`vt-v ${sugarFlag(r.sugar, r.sugarWhen).c}`}>{bn(r.sugar)} <span className="xs muted">{WHEN[r.sugarWhen ?? "random"]}</span></span> : "—"}</td>
                  <td>{r.weight !== null ? `${bn(r.weight)} kg` : "—"}</td>
                  <td>{[r.temp ? `${bn(r.temp)}°F` : null, r.spo2 ? `${bn(r.spo2)}%` : null].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="small muted">{r.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="vt-note">রঙ শুধু সাধারণ রেফারেন্স সীমা বোঝায় — রোগ নির্ণয় বা চিকিৎসার জন্য ডাক্তারের পরামর্শ নিন।</p>
    </div>
  );
}
