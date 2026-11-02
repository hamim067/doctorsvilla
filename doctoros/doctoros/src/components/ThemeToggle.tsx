"use client";
import { useState } from "react";
import { Icon } from "@/components/Icons";

/** ড্যাশবোর্ডের লাইট/ডার্ক মোড — কুকিতে মনে রাখে, পেজ রিলোড ছাড়াই বদলায় */
export function ThemeToggle({ initial }: { initial: "light" | "dark" }) {
  const [mode, setMode] = useState(initial);
  const next = mode === "dark" ? "light" : "dark";
  function flip() {
    document.querySelectorAll<HTMLElement>(".dash").forEach((el) => { el.dataset.theme = next; });
    document.cookie = `dos_theme=${next}; path=/; max-age=31536000; samesite=lax`;
    setMode(next);
  }
  return (
    <button type="button" className="theme-btn" onClick={flip} aria-label={next === "dark" ? "ডার্ক মোড চালু করুন" : "লাইট মোড চালু করুন"} title={next === "dark" ? "ডার্ক মোড" : "লাইট মোড"}>
      <Icon name={mode === "dark" ? "sun" : "moon"} size={17} />
      <span>{mode === "dark" ? "লাইট মোড" : "ডার্ক মোড"}</span>
    </button>
  );
}
