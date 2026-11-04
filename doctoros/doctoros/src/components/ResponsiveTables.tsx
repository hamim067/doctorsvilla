"use client";
import { useEffect } from "react";

/**
 * মোবাইলে টেবিল → কার্ড: প্রতিটা ঘরে কলামের নাম (data-label) বসিয়ে দেয়,
 * CSS তখন সারিগুলোকে আলাদা কার্ড হিসেবে দেখায় — আড়াআড়ি স্ক্রল করতে হয় না।
 */
export function ResponsiveTables() {
  useEffect(() => {
    const label = () => {
      document.querySelectorAll<HTMLTableElement>(".table-wrap table").forEach((t) => {
        const heads = [...t.querySelectorAll("thead th")].map((th) => th.textContent?.trim() ?? "");
        if (!heads.length) return;
        t.classList.add("rt");
        t.querySelectorAll("tbody tr").forEach((tr) => {
          const cells = [...tr.children] as HTMLElement[];
          if (cells.length === 1 && (cells[0] as HTMLTableCellElement).colSpan > 1) { tr.classList.add("rt-empty"); return; }
          cells.forEach((td, i) => { if (heads[i] && td.dataset.label !== heads[i]) td.dataset.label = heads[i]; if (!heads[i]) td.classList.add("rt-act"); });
        });
      });
    };
    label();
    const mo = new MutationObserver(() => label());
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return null;
}
