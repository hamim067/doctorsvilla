// ভিজিটিং কার্ডের ডিজাইন — ফরম্যাট, রং, কোন তথ্য থাকবে (ব্রাউজার আর সার্ভার দুজনেই)
import { z } from "zod";
import type { ColorId } from "@/lib/rxpad";

export const CARD_TEMPLATES = [
  { id: "corner", name: "রঙিন কোণ", desc: "বামে রঙিন অংশে লোগো, ডানে নাম ও যোগাযোগ" },
  { id: "minimal", name: "সাদা মিনিমাল", desc: "মাঝখানে নাম, নিচে পাতলা রঙের দাগ" },
  { id: "dark", name: "গাঢ় রঙ", desc: "পুরো কার্ড গাঢ় রঙে, সাদা লেখা — চোখে পড়ে" },
  { id: "qr", name: "বড় QR", desc: "ডানে বড় QR — স্ক্যান করে সিরিয়াল" },
  { id: "band", name: "উপরে ব্যান্ড", desc: "উপরে রঙিন পট্টিতে নাম, নিচে চেম্বার" },
] as const;
export type CardTemplate = (typeof CARD_TEMPLATES)[number]["id"];

export type CardFields = { degrees: boolean; specialty: boolean; bmdc: boolean; phone: boolean; chamber: boolean; schedule: boolean; website: boolean; qr: boolean };
export type CardSettings = { template: CardTemplate; color: ColorId; showLogo: boolean; back: boolean; fields: CardFields; tagline: string };

export const DEFAULT_CARD: CardSettings = {
  template: "corner", color: "teal", showLogo: true, back: true, tagline: "",
  fields: { degrees: true, specialty: true, bmdc: true, phone: true, chamber: true, schedule: true, website: true, qr: true },
};

const flag = z.boolean().catch(true);
export const cardSchema = z.object({
  template: z.enum(["corner", "minimal", "dark", "qr", "band"]).catch("corner"),
  color: z.enum(["teal", "blue", "green", "maroon", "purple"]).catch("teal"),
  showLogo: flag, back: flag,
  tagline: z.string().trim().max(60).catch(""),
  fields: z.object({ degrees: flag, specialty: flag, bmdc: flag, phone: flag, chamber: flag, schedule: flag, website: flag, qr: flag }).catch(DEFAULT_CARD.fields),
});

export function normalizeCard(raw: unknown): CardSettings {
  const r = cardSchema.safeParse({ ...DEFAULT_CARD, ...((raw as object) ?? {}), fields: { ...DEFAULT_CARD.fields, ...((raw as { fields?: object })?.fields ?? {}) } });
  return r.success ? r.data : DEFAULT_CARD;
}

/** কার্ডে বসানোর তথ্য — প্রোফাইল, চেম্বার, প্যাডের যোগাযোগ থেকে নেওয়া (আবার লিখতে হয় না) */
export type CardData = {
  name: string; degrees: string; specialty: string; bmdcNo: string;
  phone: string; website: string; email: string; hospital: string;
  chambers: { name: string; city: string; address: string; schedule: string }[];
  qrSvg: string | null; logoUrl: string | null; url: string;
};
