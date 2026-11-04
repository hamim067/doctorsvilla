"use client";
import { Icon } from "@/components/Icons";

/** ডিজাইনারের একেকটা ধাপ — একবারে একটাই খোলা, বন্ধ অবস্থায় এখনকার বাছাই দেখায় */
export function Step({ n, title, hint, open, onToggle, children }: { n: number; title: string; hint?: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <section className={`card st${open ? " open" : ""}`}>
      <button type="button" className="st-h" aria-expanded={open} onClick={onToggle}>
        <span className="st-n">{n}</span>
        <span className="st-t"><b>{title}</b>{hint && !open && <small>{hint}</small>}</span>
        <Icon name="chevron" size={20} />
      </button>
      {open && <div className="st-b">{children}</div>}
    </section>
  );
}
