"use client";
import { useEffect } from "react";

/**
 * প্রিন্টের পাতা (A4/A5) মোবাইলে স্ক্রিনের চওড়ায় ছোট করে দেখায় — পাশে স্ক্রল করতে হয় না।
 * প্রিন্ট বা PDF করার সময় আসল মাপেই ছাপা হয় (print.css-এ zoom: 1)।
 */
export function FitPaper() {
  useEffect(() => {
    const fit = () => {
      document.querySelectorAll<HTMLElement>(".pr-desk").forEach((desk) => {
        const room = desk.clientWidth - 24;
        [...desk.children].forEach((el) => {
          const e = el as HTMLElement;
          e.style.zoom = "1";
          const w = e.scrollWidth;
          const k = w > room ? room / w : 1;
          e.style.zoom = String(Math.round(k * 1000) / 1000);
          if (k < 1) e.style.margin = "0 auto";
        });
      });
    };
    fit();
    window.addEventListener("resize", fit);
    const before = () => document.querySelectorAll<HTMLElement>(".pr-desk > *").forEach((e) => { e.style.zoom = "1"; });
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", fit);
    return () => { window.removeEventListener("resize", fit); window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", fit); };
  }, []);
  return null;
}
