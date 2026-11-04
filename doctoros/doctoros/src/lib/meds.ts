// প্রেসক্রিপশনের ওষুধ থেকে "এখন কী চলছে, কখন খাবে, কয় দিন বাকি" বের করা
// ডোজ "১+০+১" = সকাল+দুপুর+রাত; দিন "৩০ দিন", "২ সপ্তাহ", "১ মাস", "চলবে"
import type { Medicine } from "@/db/schema";
import { addDays } from "@/lib/time";

const ascii = (s: string) => s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));

export type Slot = "morning" | "noon" | "night";
export const SLOT_LABEL: Record<Slot, string> = { morning: "সকাল", noon: "দুপুর", night: "রাত" };

/** "১+০+১" → { morning: 1, noon: 0, night: 1 }; বুঝতে না পারলে null */
export function parseDose(dose: string): Record<Slot, number> | null {
  const m = ascii(dose).replace(/\s/g, "").match(/^(\d+(?:\.\d+)?|½)\+(\d+(?:\.\d+)?|½)\+(\d+(?:\.\d+)?|½)$/);
  if (!m) return null;
  const n = (x: string) => (x === "½" ? 0.5 : Number(x));
  return { morning: n(m[1]), noon: n(m[2]), night: n(m[3]) };
}

/** কত দিন খেতে হবে — "চলবে"/"নিয়মিত" হলে Infinity, বুঝতে না পারলে null */
export function parseDays(days: string): number | null {
  const s = ascii(days).trim();
  if (!s) return null;
  if (/চলবে|নিয়মিত|সবসময়|continue/i.test(s)) return Infinity;
  const num = Number((s.match(/\d+/) ?? [])[0]);
  if (!num) return null;
  if (/মাস|month/i.test(s)) return num * 30;
  if (/সপ্তাহ|week/i.test(s)) return num * 7;
  return num;
}

export type CurrentMed = Medicine & {
  slots: Record<Slot, number> | null;
  daysLeft: number | null; // Infinity = চলবে
  startDate: string;
  endDate: string | null;
  doctorName?: string;
};

/**
 * এখন চলমান ওষুধ — সবচেয়ে নতুন প্রেসক্রিপশন আগে; একই নামের ওষুধ একবারই।
 * শেষ হয়ে যাওয়া ওষুধ বাদ; দিন লেখা না থাকলে শুধু সর্বশেষ প্রেসক্রিপশনেরটা ধরা হয়।
 */
export function currentMeds(visits: { date: string; medicines: Medicine[]; doctorName?: string }[], today: string): CurrentMed[] {
  const sorted = [...visits].sort((a, b) => (a.date < b.date ? 1 : -1));
  const seen = new Set<string>();
  const out: CurrentMed[] = [];
  sorted.forEach((v, vi) => {
    for (const m of v.medicines) {
      const key = m.name.trim().toLowerCase().split(/\s+/)[0];
      if (!key || seen.has(key)) continue;
      const total = parseDays(m.days);
      let daysLeft: number | null = null, endDate: string | null = null;
      if (total === Infinity) daysLeft = Infinity;
      else if (total) {
        endDate = addDays(v.date, total - 1);
        const left = Math.round((Date.parse(endDate) - Date.parse(today)) / 86400000) + 1;
        if (left <= 0) { seen.add(key); continue; }
        daysLeft = left;
      } else if (vi > 0) continue; // মেয়াদ জানা নেই আর পুরনো প্রেসক্রিপশন — বাদ
      seen.add(key);
      out.push({ ...m, slots: parseDose(m.dose), daysLeft, startDate: v.date, endDate, doctorName: v.doctorName });
    }
  });
  return out;
}

/** "পেনিসিলিন, ধুলা" → ["পেনিসিলিন","ধুলা"] — একই জিনিস দুবার নয় */
export function splitList(s: string | null | undefined): string[] {
  const seen = new Set<string>();
  return (s ?? "").split(/[,،;\n]/).map((x) => x.trim()).filter((x) => x && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase()));
}
