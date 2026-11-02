"use client";
import { useState } from "react";

export function CopyButton({ text, label = "কপি করুন" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); } catch { /* পুরনো ব্রাউজার */ }
    }}>{done ? "✓ কপি হয়েছে" : label}</button>
  );
}
