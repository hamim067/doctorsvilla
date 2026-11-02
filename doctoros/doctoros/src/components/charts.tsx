"use client";
import { useId, useState } from "react";

/**
 * ড্যাশবোর্ডের চার্ট — হাতে আঁকা SVG, কোনো লাইব্রেরি নয়।
 * নিয়ম (dataviz): ২px লাইন, ~১০% এরিয়া, বার ≤২৪px ও উপরে ৪px গোল, হেয়ারলাইন গ্রিড,
 * লেখা কখনো ডেটার রঙে নয়, প্রতিটি চার্টে hover টুলটিপ ও স্ক্রিন-রিডারের জন্য টেবিল।
 */
export const CHART = { teal: "#0E8A72", orange: "#C2551A", grid: "#E6EBE8", axis: "#C9D3CF", ink: "#10231F", muted: "#55635F", surface: "#FFFFFF" };

const bn = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);

function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

type Pt = { label: string; value: number; tip: string };

function SrTable({ caption, points, unit }: { caption: string; points: Pt[]; unit: string }) {
  return (
    <table className="sr">
      <caption>{caption}</caption>
      <tbody>{points.map((p) => <tr key={p.label}><th>{p.tip}</th><td>{bn(p.value)} {unit}</td></tr>)}</tbody>
    </table>
  );
}

/** একটি সিরিজের এরিয়া চার্ট + গড়ের রেফারেন্স লাইন + crosshair টুলটিপ */
export function AreaChart({ points, caption, unit = "জন", height = 220, showAvg = true }: { points: Pt[]; caption: string; unit?: string; height?: number; showAvg?: boolean }) {
  const gid = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = height, L = 30, R = 10, T = 14, B = 26;
  const max = niceMax(Math.max(1, ...points.map((p) => p.value)));
  const x = (i: number) => L + (points.length === 1 ? 0 : (i * (W - L - R)) / (points.length - 1));
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const avg = points.reduce((a, p) => a + p.value, 0) / Math.max(1, points.length);
  const every = Math.ceil(points.length / 7);
  const last = points.length - 1;
  const h = hover ?? null;

  return (
    <div className="ch" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={caption} style={{ width: "100%", height: "auto", display: "block" }}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - L) / (W - L - R)) * (points.length - 1));
          setHover(Math.max(0, Math.min(last, i)));
        }}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={CHART.teal} stopOpacity="0.16" />
            <stop offset="1" stopColor={CHART.teal} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke={f === 0 ? CHART.axis : CHART.grid} strokeWidth="1" />
            <text x={L - 6} y={y(max * f) + 4} textAnchor="end" fontSize="11" fill={CHART.muted}>{bn(Math.round(max * f))}</text>
          </g>
        ))}
        {showAvg && avg > 0 && (
          <g>
            <line x1={L} x2={W - R} y1={y(avg)} y2={y(avg)} stroke={CHART.muted} strokeWidth="1" strokeDasharray="0" opacity="0.35" />
            <text x={W - R} y={y(avg) - 5} textAnchor="end" fontSize="11" fill={CHART.muted}>গড় {bn(avg.toFixed(1))}</text>
          </g>
        )}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={CHART.teal} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => i % every === 0 || i === last ? (
          <text key={p.label} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"} fontSize="11" fill={CHART.muted}>{p.label}</text>
        ) : null)}
        {h === null && (
          <g>
            <circle cx={x(last)} cy={y(points[last].value)} r="5" fill={CHART.teal} stroke={CHART.surface} strokeWidth="2" />
            <text x={x(last) - 9} y={y(points[last].value) - 10} textAnchor="end" fontSize="12" fontWeight="700" fill={CHART.ink}>{bn(points[last].value)}</text>
          </g>
        )}
        {h !== null && (
          <g pointerEvents="none">
            <line x1={x(h)} x2={x(h)} y1={T} y2={y(0)} stroke={CHART.axis} strokeWidth="1" />
            <circle cx={x(h)} cy={y(points[h].value)} r="5" fill={CHART.teal} stroke={CHART.surface} strokeWidth="2" />
          </g>
        )}
      </svg>
      {h !== null && (
        <div className="ch-tip" style={{ left: `${(x(h) / W) * 100}%` }}>
          <b>{bn(points[h].value)} {unit}</b><span>{points[h].tip}</span>
        </div>
      )}
      <SrTable caption={caption} points={points} unit={unit} />
    </div>
  );
}

/** কলাম চার্ট (একটি সিরিজ) — `highlight` index-এর কলাম গাঢ়, বাকিগুলো হালকা */
export function ColumnChart({ points, caption, unit = "জন", height = 200, width = 640, highlight, color = CHART.teal, empty }: { points: Pt[]; caption: string; unit?: string; height?: number; width?: number; highlight?: number; color?: string; empty?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = width, H = height, L = 30, R = 6, T = 18, B = 26;
  const isEmpty = points.every((p) => p.value === 0);
  const max = niceMax(Math.max(1, ...points.map((p) => p.value)));
  const band = (W - L - R) / points.length;
  const bw = Math.min(24, band * 0.62);
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const every = Math.ceil(points.length / 12);
  const peak = points.reduce((a, p, i) => (p.value > points[a].value ? i : a), 0);

  return (
    <div className="ch" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={caption} style={{ width: "100%", height: "auto", display: "block" }}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke={f === 0 ? CHART.axis : CHART.grid} strokeWidth="1" />
            <text x={L - 6} y={y(max * f) + 4} textAnchor="end" fontSize="11" fill={CHART.muted}>{bn(Math.round(max * f))}</text>
          </g>
        ))}
        {points.map((p, i) => {
          const cx = L + band * i + band / 2;
          const top = y(p.value), base = y(0), h = Math.max(0, base - top);
          const r = Math.min(4, h, bw / 2);
          const strong = highlight === undefined ? true : i === highlight;
          const d = h <= 0 ? "" : `M${cx - bw / 2},${base} L${cx - bw / 2},${top + r} Q${cx - bw / 2},${top} ${cx - bw / 2 + r},${top} L${cx + bw / 2 - r},${top} Q${cx + bw / 2},${top} ${cx + bw / 2},${top + r} L${cx + bw / 2},${base} Z`;
          return (
            <g key={p.label} onMouseEnter={() => setHover(i)}>
              <rect x={L + band * i} y={T} width={band} height={H - T - B} fill="transparent" />
              {d && <path d={d} fill={color} opacity={hover === null ? (strong ? 1 : 0.38) : hover === i ? 1 : 0.38} />}
              {(i % every === 0 || i === points.length - 1) && <text x={cx} y={H - 7} textAnchor="middle" fontSize="11" fill={CHART.muted}>{p.label}</text>}
              {i === peak && p.value > 0 && hover === null && <text x={cx} y={top - 5} textAnchor="middle" fontSize="12" fontWeight="700" fill={CHART.ink}>{bn(p.value)}</text>}
            </g>
          );
        })}
      </svg>
      {isEmpty && empty && <div className="ch-empty">{empty}</div>}
      {hover !== null && !isEmpty && (
        <div className="ch-tip" style={{ left: `${((L + band * hover + band / 2) / W) * 100}%` }}>
          <b>{bn(points[hover].value)} {unit}</b><span>{points[hover].tip}</span>
        </div>
      )}
      <SrTable caption={caption} points={points} unit={unit} />
    </div>
  );
}

/** KPI টাইলের ছোট ট্রেন্ড লাইন — অক্ষ নেই, শেষ বিন্দুতে ডট */
export function Sparkline({ values, color = CHART.teal, label }: { values: number[]; color?: string; label: string }) {
  const W = 120, H = 36, P = 4;
  const max = Math.max(1, ...values), min = Math.min(0, ...values);
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, values.length - 1);
  const y = (v: number) => P + (H - 2 * P) * (1 - (v - min) / (max - min || 1));
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label}>
      <path d={`${d} L${x(last)},${H - P} L${x(0)},${H - P} Z`} fill={color} opacity="0.1" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(values[last] ?? 0)} r="4" fill={color} stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

/** দুই ভাগের অনুপাত বার (যেমন নতুন বনাম ফলোআপ) — ২px ফাঁক, লেজেন্ড সহ */
export function SplitBar({ a, b, aLabel, bLabel }: { a: number; b: number; aLabel: string; bLabel: string }) {
  const t = a + b || 1;
  const pa = Math.round((a / t) * 100);
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="split" role="img" aria-label={`${aLabel} ${a}, ${bLabel} ${b}`}>
        {a > 0 && <span style={{ flexBasis: `${(a / t) * 100}%`, background: CHART.teal }} />}
        {b > 0 && <span style={{ flexBasis: `${(b / t) * 100}%`, background: CHART.orange }} />}
      </div>
      <div className="row-sb small">
        <span className="leg"><i style={{ background: CHART.teal }} />{aLabel} <b>{bn(a)}</b> <span className="muted">({bn(pa)}%)</span></span>
        <span className="leg"><i style={{ background: CHART.orange }} />{bLabel} <b>{bn(b)}</b> <span className="muted">({bn(100 - pa)}%)</span></span>
      </div>
    </div>
  );
}
