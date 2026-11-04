// বাংলাদেশ সময় (UTC+6, ডেলাইট সেভিং নেই) অনুযায়ী তারিখের হিসাব
const TZ = "Asia/Dhaka";

/** আজকের তারিখ "YYYY-MM-DD" (ঢাকা) */
export function today(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** তারিখের সাথে দিন যোগ/বিয়োগ */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** 0 = রবিবার … 6 = শনিবার */
export function weekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const WEEKDAYS_BN = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
export const WEEKDAYS_SHORT_BN = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];
export const MONTHS_BN = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];

export function bn(n: number | string): string {
  return String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
}

/** "2026-11-02" → "সোমবার, ২ নভেম্বর" */
export function formatDateBn(date: string, withWeekday = true): string {
  const [, m, d] = date.split("-").map(Number);
  const s = `${bn(d)} ${MONTHS_BN[m - 1]}`;
  return withWeekday ? `${WEEKDAYS_BN[weekday(date)]}, ${s}` : s;
}

/** "18:30" → "সন্ধ্যা ৬:৩০" */
export function formatTimeBn(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const part = h < 12 ? "সকাল" : h < 15 ? "দুপুর" : h < 18 ? "বিকাল" : h < 20 ? "সন্ধ্যা" : "রাত";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${part} ${bn(h12)}:${bn(String(m).padStart(2, "0"))}`;
}

/** সময়কে ঢাকার ঘড়ি অনুযায়ী "HH:MM" */
export function clockDhaka(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

/** এই বছর (ঢাকার ক্যালেন্ডারে) */
export const thisYear = () => Number(today().slice(0, 4));

/** কোনো মুহূর্তের তারিখ "YYYY-MM-DD" — ঢাকা সময়ে (UTC নয়) */
export function dateDhaka(d: Date): string {
  return today(d);
}
