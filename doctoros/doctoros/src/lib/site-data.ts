// ডাক্তারের ওয়েবসাইটের সব তথ্য গোছানো — পাবলিক পেজ আর এডিটরের লাইভ প্রিভিউ দুজনেই ব্যবহার করে
import "server-only";
import type { WsChamber, WsData } from "@/app/dr/[slug]/Website";
import type { Chamber, Doctor } from "@/db/schema";
import { upcomingDays } from "@/lib/booking";
import { doctorAssetUrls } from "@/lib/assets";
import { hasEnglish, normalize, patientsSeen } from "@/lib/site";
import type { SiteContent } from "@/db/schema";
import { addDays, bn, formatDateBn, formatTimeBn, today, WEEKDAYS_BN } from "@/lib/time";

type Sched = { id: string; chamberId: string; weekday: number; startTime: string; endTime: string };
export type SiteBundle = {
  doctor: Doctor;
  chambers: (Chamber & { schedules: Sched[] })[];
  site: { content: SiteContent | null; hasPhoto: boolean; updatedAt: Date } | null;
};

// শনিবার থেকে সাজানো
const sortWeek = (a: { weekday: number }, b: { weekday: number }) => ((a.weekday + 1) % 7) - ((b.weekday + 1) % 7);

const WEEK_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function timeEn(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
export function linesFor(list: { weekday: number; startTime: string; endTime: string }[], lang: "bn" | "en") {
  const groups = new Map<string, number[]>();
  for (const s of [...list].sort(sortWeek)) {
    const k = `${s.startTime}-${s.endTime}`;
    groups.set(k, [...(groups.get(k) ?? []), s.weekday]);
  }
  const dn = (w: number) => (lang === "bn" ? WEEKDAYS_BN[w].replace("বার", "") : WEEK_EN[w]);
  return [...groups.entries()].map(([k, days]) => {
    const [st, en] = k.split("-");
    // টানা দিন হলে "শনি–বুধ", নইলে কমা দিয়ে
    const order = days.map((w) => (w + 1) % 7);
    const run = order.every((o, i) => i === 0 || o === order[i - 1] + 1);
    const names = days.length === 7 ? (lang === "bn" ? "প্রতিদিন" : "Every day") : run && days.length > 2 ? `${dn(days[0])}–${dn(days[days.length - 1])}` : days.map(dn).join(", ");
    return lang === "bn" ? `${names} · ${formatTimeBn(st)} – ${formatTimeBn(en)}` : `${names} · ${timeEn(st)} – ${timeEn(en)}`;
  });
}


export async function websiteData(data: SiteBundle, preview: WsData["preview"]): Promise<WsData> {
  const { doctor, chambers, site } = data;
  const content = normalize(site?.content, doctor);
  const t = today();
  const tomorrow = addDays(t, 1);
  const [seen, ups, assets] = await Promise.all([patientsSeen(doctor.id), Promise.all(chambers.map((c) => upcomingDays(c))), doctorAssetUrls(doctor.id, doctor.slug)]);
  const wsChambers: WsChamber[] = chambers.map((c, i) => {
    const days = ups[i];
    const td = days.find((x) => x.date === t);
    const off = [0, 1, 2, 3, 4, 5, 6].filter((w) => !c.schedules.some((s) => s.weekday === w)).sort((a, b) => ((a + 1) % 7) - ((b + 1) % 7));
    return {
      id: c.id, name: c.name, address: c.address, city: c.city, feeNew: c.feeNew, feeFollowUp: c.feeFollowUp,
      schedBn: linesFor(c.schedules, "bn"), schedEn: linesFor(c.schedules, "en"),
      offBn: off.length && off.length < 7 ? off.map((w) => WEEKDAYS_BN[w]).join(", ") : "",
      offEn: off.length && off.length < 7 ? off.map((w) => WEEK_EN[w]).join(", ") : "",
      todayBn: !td?.open ? "আজ বন্ধ" : td.onlineLeft > 0 ? `আজ ${bn(td.onlineLeft)}টি অনলাইন সিরিয়াল খালি` : "আজকের অনলাইন সিরিয়াল শেষ",
      todayEn: !td?.open ? "Closed today" : td.onlineLeft > 0 ? `${td.onlineLeft} online serials left today` : "Today's online serials are full",
      todayCls: !td?.open ? "muted" : td.onlineLeft > 0 ? "ok" : "warn",
      days: days.filter((x) => x.open && x.onlineLeft > 0).slice(0, 10).map((x) => {
        const [, m, dnum] = x.date.split("-").map(Number);
        const wd = new Date(`${x.date}T00:00:00Z`).getUTCDay();
        const relBn = x.date === t ? "আজ, " : x.date === tomorrow ? "কাল, " : "";
        const relEn = x.date === t ? "Today, " : x.date === tomorrow ? "Tomorrow, " : "";
        return {
          date: x.date,
          bn: `${relBn}${formatDateBn(x.date)}${x.startTime ? ` · ${formatTimeBn(x.startTime)}` : ""} (${bn(x.onlineLeft)}টি খালি)`,
          en: `${relEn}${WEEK_EN[wd]}, ${dnum} ${MONTH_EN[m - 1]}${x.startTime ? ` · ${timeEn(x.startTime)}` : ""} (${x.onlineLeft} left)`,
        };
      }),
    };
  });
  const todays = ups.map((d) => d.find((x) => x.date === t));
  const openToday = todays.some((x) => x?.open && x.onlineLeft > 0) ? "open" : todays.some((x) => x?.open) ? "full" : "closed";
  const photo = site?.hasPhoto ? `/dr/${doctor.slug}/photo?v=${site.updatedAt.getTime()}` : null;
  return {
    slug: doctor.slug, name: doctor.name, degrees: doctor.degrees, bmdcNo: doctor.bmdcNo, verified: doctor.bmdcVerified,
    photo, content, english: hasEnglish(content), logoUrl: assets.logoUrl ?? null,
    stats: { experience: doctor.experienceYears, patients: seen, chambers: chambers.length },
    chambers: wsChambers, openToday, preview, year: Number(t.slice(0, 4)),
  };
}
