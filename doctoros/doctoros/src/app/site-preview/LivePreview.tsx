"use client";
import { useEffect, useState } from "react";
import { DoctorWebsite, type WsData } from "@/app/dr/[slug]/Website";
import type { SiteContent } from "@/db/schema";

type Msg =
  | { type: "dv-content"; content: SiteContent; photo: string | null; lang: "bn" | "en"; dark: boolean; experience?: number | null }
  | { type: "dv-scroll"; id: string };

export function LivePreview({ initial }: { initial: WsData }) {
  const [d, setD] = useState(initial);
  const [lang, setLang] = useState<"bn" | "en">("bn");
  useEffect(() => {
    const on = (e: MessageEvent<Msg>) => {
      if (e.origin !== location.origin) return;
      const m = e.data;
      if (m?.type === "dv-content") {
        setD({
          ...initial,
          content: m.content,
          english: Boolean(m.content.en.designation.trim() && m.content.en.heroTitle.trim()),
          photo: m.photo === "keep" ? initial.photo : m.photo,
          stats: { ...initial.stats, experience: m.experience === undefined ? initial.stats.experience : m.experience },
        });
        setLang(m.lang);
        document.documentElement.dataset.theme = m.dark ? "dark" : "light";
      } else if (m?.type === "dv-scroll") {
        document.getElementById(m.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    window.addEventListener("message", on);
    document.documentElement.dataset.theme = "light";
    window.parent?.postMessage({ type: "dv-ready" }, location.origin);
    return () => window.removeEventListener("message", on);
  }, [initial]);
  return <DoctorWebsite d={d} live forceLang={lang} />;
}
