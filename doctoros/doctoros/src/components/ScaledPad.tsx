"use client";
import { useEffect, useRef, useState } from "react";
import { RxPad } from "@/components/RxPad";
import type { PadData, PadSettings } from "@/lib/rxpad";

const MM = 3.7795;
/** প্যাডকে স্ক্রিনের চওড়া অনুযায়ী ছোট করে দেখানো (আসল মাপ মিমিতে) */
export function ScaledPad({ s, d }: { s: PadSettings; d: PadData }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(340);
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
    <div ref={ref} style={{ position: "relative", width: "100%", height: ph * k, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: pw, transform: `scale(${k})`, transformOrigin: "0 0" }}><RxPad s={s} d={d} /></div>
    </div>
  );
}
