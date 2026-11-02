"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icons";

type Mode = "light" | "dark";
const EVT = "dos-theme";

/**
 * পুরো সাইটের লাইট/ডার্ক মোড — <html data-theme> বদলায়, কুকিতে মনে রাখে।
 * রুট লেআউটের ছোট স্ক্রিপ্ট পেজ আঁকার আগেই কুকি পড়ে নেয়, তাই ঝলক দেখা যায় না।
 */
export function ThemeToggle({ className = "theme-btn", label = true }: { className?: string; label?: boolean }) {
  const [mode, setMode] = useState<Mode>("light");
  useEffect(() => {
    const read = () => setMode(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    read();
    window.addEventListener(EVT, read);
    return () => window.removeEventListener(EVT, read);
  }, []);
  const next: Mode = mode === "dark" ? "light" : "dark";
  function flip() {
    document.documentElement.dataset.theme = next;
    document.cookie = `dos_theme=${next}; path=/; max-age=31536000; samesite=lax`;
    window.dispatchEvent(new Event(EVT));
  }
  const text = next === "dark" ? "ডার্ক মোড" : "লাইট মোড";
  return (
    <button type="button" className={className} onClick={flip} aria-label={`${text} চালু করুন`} title={text}>
      <Icon name={mode === "dark" ? "sun" : "moon"} size={17} />
      {label && <span>{text}</span>}
    </button>
  );
}
