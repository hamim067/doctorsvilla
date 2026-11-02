// ডাক্তারের Premium ওয়েবসাইট — প্ল্যান যাচাই, ডিফল্ট লেখা, ইনপুট যাচাই
import "server-only";
import { and, count, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import type { SiteContent, SiteText } from "@/db/schema";
import { today } from "@/lib/time";

/**
 * লঞ্চ অফার: PREMIUM_FREE_FOR_ALL=0 না দেওয়া পর্যন্ত সব ডাক্তার Premium পান।
 * পরে টাকা নেওয়া শুরু করলে Vercel-এ PREMIUM_FREE_FOR_ALL=0 দিলেই হবে —
 * তখন শুধু plan=PREMIUM (মেয়াদসহ) ডাক্তারদের ওয়েবসাইট দেখাবে। কারো লেখা মুছবে না।
 */
export const premiumFreeForAll = () => process.env.PREMIUM_FREE_FOR_ALL !== "0";
/** অফার কবে পর্যন্ত — শুধু দেখানোর জন্য, যেমন "2027-06-30" */
export const premiumOfferUntil = () => process.env.PREMIUM_FREE_UNTIL || null;

export function hasPremium(d: { plan: string; premiumUntil: string | null }) {
  if (premiumFreeForAll()) return true;
  return d.plan === "PREMIUM" && (!d.premiumUntil || d.premiumUntil >= today());
}

/** সেবার আইকন — ডাক্তার এখান থেকে বেছে নেন */
export const SERVICE_ICONS = ["heart", "pulse", "steth", "brain", "bone", "tooth", "eye", "ear", "child", "gyn", "skin", "drop", "pill", "syringe", "micro", "shield"] as const;

const emptyText = (): SiteText => ({
  designation: "", topNote: "", heroTitle: "", heroText: "", about: "", servicesTitle: "",
  services: [], faqs: [], emergency: "",
});

/** নতুন ওয়েবসাইটের শুরুর লেখা — প্রোফাইলের তথ্য দিয়ে ভরা, ডাক্তার পরে বদলাবেন */
export function defaultContent(d: { specialty: string; bio: string | null }): SiteContent {
  return {
    theme: "navy",
    sections: { topbar: true, stats: true, services: true, about: true, chambers: true, booking: true, faq: true, emergency: true },
    stats: { experience: true, patients: true, chambers: true },
    hotline: "", whatsapp: "", email: "", facebook: "", youtube: "", linkedin: "",
    bn: {
      ...emptyText(),
      designation: d.specialty,
      heroTitle: `${d.specialty} — যত্নশীল ও আধুনিক চিকিৎসা`,
      heroText: d.bio?.slice(0, 220) ?? "",
      about: d.bio ?? "",
      servicesTitle: "যেসব সমস্যার চিকিৎসা করা হয়",
      services: [{ title: "", desc: "", icon: "steth" }],
      faqs: [{ q: "রিপোর্ট দেখাতে কি আবার ফি লাগে?", a: "" }],
      emergency: "জরুরি অবস্থায় অপেক্ষা না করে নিকটস্থ হাসপাতালের ইমার্জেন্সিতে যান বা ৯৯৯-এ কল করুন।",
    },
    en: emptyText(),
  };
}

/** পুরনো সেভ করা লেখায় নতুন ঘর না থাকলে ডিফল্ট বসায় */
export function normalize(c: Partial<SiteContent> | null | undefined, d: { specialty: string; bio: string | null }): SiteContent {
  const base = defaultContent(d);
  if (!c) return base;
  return {
    ...base, ...c,
    sections: { ...base.sections, ...c.sections },
    stats: { ...base.stats, ...c.stats },
    bn: { ...emptyText(), ...c.bn },
    en: { ...emptyText(), ...c.en },
  };
}

/** ইংরেজি সংস্করণ চালু কিনা — অন্তত পদবি আর হিরোর শিরোনাম লিখলে */
export const hasEnglish = (c: SiteContent) => Boolean(c.en.designation.trim() && c.en.heroTitle.trim());

// ---- ইনপুট যাচাই (ডাক্তারের ফর্ম থেকে আসা JSON) ----
const s = (max: number) => z.string().trim().max(max, `লেখা ${max} অক্ষরের মধ্যে রাখুন`).default("");
const url = z.string().trim().max(300).default("").refine((v) => !v || /^https?:\/\/\S+$/i.test(v), "লিংক https:// দিয়ে শুরু করুন");
const textSchema = z.object({
  name: s(80).optional(), degrees: s(200).optional(),
  designation: s(120), topNote: s(140), heroTitle: s(120), heroText: s(400), about: s(2500), servicesTitle: s(120),
  services: z.array(z.object({ title: s(80), desc: s(240), icon: z.enum(SERVICE_ICONS).catch("steth") })).max(12, "সর্বোচ্চ ১২টি সেবা").default([]),
  faqs: z.array(z.object({ q: s(160), a: s(600) })).max(12, "সর্বোচ্চ ১২টি প্রশ্ন").default([]),
  emergency: s(300),
});
const flag = z.boolean().default(true);
export const contentSchema = z.object({
  theme: z.enum(["navy", "green", "plum"]).catch("navy"),
  sections: z.object({ topbar: flag, stats: flag, services: flag, about: flag, chambers: flag, booking: flag, faq: flag, emergency: flag }),
  stats: z.object({ experience: flag, patients: flag, chambers: flag }),
  hotline: s(20), whatsapp: s(20), email: z.string().trim().max(120).default("").refine((v) => !v || /^\S+@\S+\.\S+$/.test(v), "সঠিক ইমেইল দিন"),
  facebook: url, youtube: url, linkedin: url,
  bn: textSchema, en: textSchema,
});

/** খালি সেবা/প্রশ্ন বাদ, ইংরেজি তালিকা বাংলার সাথে মিলিয়ে রাখা */
export function tidy(c: SiteContent): SiteContent {
  const keep = c.bn.services.map((x, i) => ({ x, i })).filter(({ x }) => x.title.trim());
  const keepF = c.bn.faqs.map((x, i) => ({ x, i })).filter(({ x }) => x.q.trim() && x.a.trim());
  return {
    ...c,
    bn: { ...c.bn, services: keep.map(({ x }) => x), faqs: keepF.map(({ x }) => x) },
    en: {
      ...c.en,
      services: keep.map(({ x, i }) => ({ title: c.en.services[i]?.title ?? "", desc: c.en.services[i]?.desc ?? "", icon: x.icon })),
      faqs: keepF.map(({ i }) => ({ q: c.en.faqs[i]?.q ?? "", a: c.en.faqs[i]?.a ?? "" })),
    },
  };
}

/** পাবলিক পেজের জন্য: ওয়েবসাইট আছে কিনা, ছবি আছে কিনা (ছবির ডেটা ছাড়া) */
export async function loadSite(doctorId: string) {
  const [row] = await db.select({
    published: schema.doctorSites.published,
    content: schema.doctorSites.content,
    hasPhoto: isNotNull(schema.doctorSites.photo),
    updatedAt: schema.doctorSites.updatedAt,
  }).from(schema.doctorSites).where(eq(schema.doctorSites.doctorId, doctorId)).limit(1);
  return row ?? null;
}

/** কতজন আলাদা রোগী দেখেছেন (এই প্ল্যাটফর্মে, সম্পন্ন ভিজিট) — যাচাইযোগ্য আসল সংখ্যা */
export async function patientsSeen(doctorId: string) {
  const [r] = await db.select({ n: count(sql`distinct ${schema.bookings.patientId}`) }).from(schema.bookings)
    .where(and(eq(schema.bookings.doctorId, doctorId), eq(schema.bookings.status, "DONE")));
  return Number(r?.n ?? 0);
}
