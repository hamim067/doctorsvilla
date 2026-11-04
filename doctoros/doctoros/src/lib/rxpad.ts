// প্রেসক্রিপশন প্যাডের ডিজাইন — ফরম্যাট, রং, কাগজের মাপ, কোন অংশ দেখাবে
// (সার্ভার আর ব্রাউজার দুজনেই ব্যবহার করে — এখানে DB নেই)
import { z } from "zod";
import type { Medicine } from "@/db/schema";

export const TEMPLATES = [
  { id: "teal", name: "আধুনিক কোণ", desc: "উপরে কোণাকুণি দাগ, বামে C/C ও D/E-র কলাম, নিচে কল বক্স" },
  { id: "blue", name: "নীল মিনিমাল", desc: "স্টেথোস্কোপ লোগো, রোগীর তথ্যের লাইন, নিচে যোগাযোগ" },
  { id: "classic", name: "ক্লাসিক", desc: "সাদামাটা দুই কলাম — সব তথ্য গুছিয়ে" },
  { id: "preprinted", name: "ছাপানো প্যাডে", desc: "আপনার নিজের ছাপানো প্যাডে শুধু লেখা প্রিন্ট হবে" },
  { id: "custom", name: "আমার প্যাড", desc: "আপনার প্যাডের ছবি আপলোড করুন — সাদা কাগজেই পুরো প্যাড সহ প্রিন্ট হবে" },
] as const;
export type TemplateId = (typeof TEMPLATES)[number]["id"];

export const COLORS = {
  teal: { name: "টিল ও নেভি", a: "#12857A", b: "#163E6C", soft: "#E3F3F1" },
  blue: { name: "নীল", a: "#2F6DB5", b: "#183F6E", soft: "#E6F0FA" },
  green: { name: "সবুজ", a: "#2F8A57", b: "#1D4A33", soft: "#E5F3EA" },
  maroon: { name: "মেরুন", a: "#A23B48", b: "#4F1C27", soft: "#F8E8EA" },
  purple: { name: "বেগুনি", a: "#6A4FB3", b: "#33235F", soft: "#EFEBF8" },
} as const;
export type ColorId = keyof typeof COLORS;

export type PadSections = { vitals: boolean; investigation: boolean; advice: boolean; followup: boolean; qr: boolean; signature: boolean; watermark: boolean };
export type PadSettings = {
  template: TemplateId; color: ColorId; paper: "A4" | "A5"; labels: "bn" | "en";
  hospital: string; slogan: string; phone: string; website: string; email: string;
  sections: PadSections;
  /** ছাপানো/নিজের প্যাডে উপরে-নিচে-বামে-ডানে কত মিমি ফাঁকা রাখবে */
  topMm: number; bottomMm: number; leftMm: number; rightMm: number;
  /** লোগো আপলোড থাকলে প্যাডে দেখাবে */
  showLogo: boolean;
};

export const DEFAULT_PAD: PadSettings = {
  template: "teal", color: "teal", paper: "A4", labels: "bn",
  hospital: "", slogan: "", phone: "", website: "", email: "",
  sections: { vitals: true, investigation: true, advice: true, followup: true, qr: true, signature: true, watermark: true },
  topMm: 50, bottomMm: 25, leftMm: 14, rightMm: 14, showLogo: true,
};

const t = (max: number) => z.string().trim().max(max).catch("");
const flag = z.boolean().catch(true);
export const padSchema = z.object({
  template: z.enum(["teal", "blue", "classic", "preprinted", "custom"]).catch("teal"),
  color: z.enum(["teal", "blue", "green", "maroon", "purple"]).catch("teal"),
  paper: z.enum(["A4", "A5"]).catch("A4"),
  labels: z.enum(["bn", "en"]).catch("bn"),
  hospital: t(80), slogan: t(120), phone: t(40), website: t(80), email: t(80),
  sections: z.object({ vitals: flag, investigation: flag, advice: flag, followup: flag, qr: flag, signature: flag, watermark: flag }).catch(DEFAULT_PAD.sections),
  topMm: z.number().int().min(0).max(120).catch(50),
  bottomMm: z.number().int().min(0).max(80).catch(25),
  leftMm: z.number().int().min(0).max(60).catch(14),
  rightMm: z.number().int().min(0).max(60).catch(14),
  showLogo: z.boolean().catch(true),
});

export function normalizePad(raw: unknown): PadSettings {
  const r = padSchema.safeParse({ ...DEFAULT_PAD, ...(raw as object ?? {}), sections: { ...DEFAULT_PAD.sections, ...((raw as { sections?: object })?.sections ?? {}) } });
  return r.success ? r.data : DEFAULT_PAD;
}

export const LABELS = {
  bn: {
    name: "নাম", age: "বয়স", sex: "লিঙ্গ", date: "তারিখ", id: "আইডি", address: "ঠিকানা", serial: "সিরিয়াল",
    cc: "অভিযোগ (C/C)", dx: "রোগ নির্ণয় (D/E)", vitals: "শারীরিক মাপ", inv: "পরীক্ষা (Investigation)", adv: "পরামর্শ",
    fu: "পরবর্তী সাক্ষাৎ", sign: "স্বাক্ষর ও সিল", call: "সিরিয়ালের জন্য কল", qr: "পরের সিরিয়াল নিতে স্ক্যান করুন",
    bp: "BP", pulse: "পালস", weight: "ওজন", temp: "তাপমাত্রা", spo2: "SpO₂", years: "বছর", bmdc: "BMDC রেজি",
  },
  en: {
    name: "Patient Name", age: "Age", sex: "Sex", date: "Date", id: "ID", address: "Address", serial: "Serial",
    cc: "C/C", dx: "D/E", vitals: "Vitals", inv: "Investigation", adv: "Advice",
    fu: "Next Visit", sign: "Signature & Seal", call: "Call for serial", qr: "Scan for next serial",
    bp: "BP", pulse: "Pulse", weight: "Weight", temp: "Temp", spo2: "SpO₂", years: "yrs", bmdc: "BMDC Reg",
  },
} as const;

/** প্যাডে বসানোর তথ্য */
export type PadData = {
  doctor: { name: string; degrees: string; specialty: string; bmdcNo: string };
  chamber: { name: string; address: string; city: string } | null;
  patient: { name: string; age: number | null; gender: string | null; code: string };
  date: string; // দেখানোর জন্য গোছানো তারিখ
  serial?: string | null;
  visit: { complaint: string | null; diagnosis: string | null; medicines: Medicine[]; advice: string | null; investigations: string | null; followUp: string | null } | null;
  vitals: { bp?: string; pulse?: string; weight?: string; temp?: string; spo2?: string } | null;
  qrSvg?: string | null;
  url?: string | null;
  /** আপলোড করা লোগো আর নিজের প্যাডের ছবির লিংক */
  logoUrl?: string | null;
  padUrl?: string | null;
  /** স্বাক্ষর আর সিলের ছবি (সাদা পটভূমি সরানো PNG) */
  signUrl?: string | null;
  sealUrl?: string | null;
};

/** নমুনা — ডিজাইন বাছার সময় প্রিভিউতে দেখানোর জন্য */
export function sampleData(doctor: PadData["doctor"], chamber: PadData["chamber"]): PadData {
  return {
    doctor, chamber,
    patient: { name: "রহিম উদ্দিন", age: 42, gender: "পুরুষ", code: "P-10001" },
    date: "৪ নভেম্বর ২০২৬", serial: "৫",
    visit: {
      complaint: "মাথা ঘোরা, মাঝে মাঝে বুক ধড়ফড়",
      diagnosis: "উচ্চ রক্তচাপ",
      medicines: [
        { name: "Tab. Amlodipine 5mg", dose: "০+০+১", when: "রাতে খাবারের পরে", days: "৩০ দিন" },
        { name: "Tab. Rosuvastatin 10mg", dose: "০+০+১", when: "রাতে", days: "৩০ দিন" },
        { name: "Tab. Ecosprin 75mg", dose: "০+১+০", when: "দুপুরে খাবারের পরে", days: "চলবে" },
      ],
      advice: "লবণ কম খাবেন, প্রতিদিন ৩০ মিনিট হাঁটবেন",
      investigations: "CBC, Lipid profile, ECG",
      followUp: "৪ ডিসেম্বর ২০২৬",
    },
    vitals: { bp: "১৪৫/৯২", pulse: "৮৪", weight: "৭৮ kg", temp: "৯৮.৪°F", spo2: "৯৮%" },
  };
}

/** রং থেকে সবচেয়ে কাছের প্যাডের রং — লোগোর সাথে মিলিয়ে নিতে */
export function nearestColor(hex: string): ColorId {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = rgb(hex);
  let best: ColorId = "teal", bd = Infinity;
  for (const [k, v] of Object.entries(COLORS) as [ColorId, (typeof COLORS)[ColorId]][]) {
    const [r2, g2, b2] = rgb(v.a);
    const dd = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
    if (dd < bd) { bd = dd; best = k; }
  }
  return best;
}
