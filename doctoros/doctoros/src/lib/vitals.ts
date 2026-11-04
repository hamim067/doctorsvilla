// রোগীর স্বাস্থ্যের রিডিং — যাচাই, পড়া আর সহজ ভাষায় দেখানো
import "server-only";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Vital } from "@/db/schema";
import { today } from "@/lib/time";

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/[,\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

/** ফর্ম থেকে রিডিং — অন্তত একটা মান লাগবে, অসম্ভব মান ধরা হয় */
export function parseVital(fd: FormData): { error: string } | { value: Omit<Vital, "id" | "patientId" | "doctorId" | "source" | "createdAt"> } {
  const date = String(fd.get("date") ?? "").trim() || today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "সঠিক তারিখ দিন" };
  if (date > today()) return { error: "ভবিষ্যতের তারিখ দেওয়া যাবে না" };
  const sys = num(fd.get("systolic")), dia = num(fd.get("diastolic")), pulse = num(fd.get("pulse"));
  const sugar = num(fd.get("sugar")), weight = num(fd.get("weight"));
  for (const v of [sys, dia, pulse, sugar, weight]) if (Number.isNaN(v)) return { error: "শুধু সংখ্যা লিখুন" };
  if ((sys === null) !== (dia === null)) return { error: "প্রেসারের দুটো সংখ্যাই দিন (যেমন ১২০ / ৮০)" };
  if (sys !== null && (sys < 60 || sys > 260 || dia! < 30 || dia! > 160 || dia! >= sys)) return { error: "প্রেসারের মান ঠিক আছে কিনা দেখুন (যেমন ১২০ / ৮০)" };
  if (pulse !== null && (pulse < 30 || pulse > 220)) return { error: "পালসের মান ঠিক আছে কিনা দেখুন" };
  // সুগার: ৩৫-এর বেশি লিখলে mg/dL ধরে mmol/L-এ বদলাই
  let sugarMmol = sugar;
  if (sugarMmol !== null && sugarMmol > 35) sugarMmol = sugarMmol / 18;
  if (sugarMmol !== null && (sugarMmol < 1 || sugarMmol > 35)) return { error: "সুগারের মান ঠিক আছে কিনা দেখুন" };
  if (weight !== null && (weight < 1 || weight > 300)) return { error: "ওজনের মান ঠিক আছে কিনা দেখুন" };
  if ([sys, pulse, sugarMmol, weight].every((v) => v === null)) return { error: "অন্তত একটা মান দিন — প্রেসার, সুগার, পালস বা ওজন" };
  const when = String(fd.get("sugarWhen") ?? "");
  return {
    value: {
      date, systolic: sys, diastolic: dia, pulse,
      sugarX10: sugarMmol === null ? null : Math.round(sugarMmol * 10),
      sugarWhen: sugarMmol === null ? null : ["fasting", "after_meal", "random"].includes(when) ? when : "random",
      weightX10: weight === null ? null : Math.round(weight * 10),
      note: String(fd.get("note") ?? "").trim().slice(0, 200) || null,
    },
  };
}

/**
 * রিডিং পড়া —
 *  ডাক্তার: নিজের নেওয়া + রোগীর নিজের দেওয়া (অন্য ডাক্তারেরটা নয়)
 *  রোগী: নিজের সবগুলো
 */
export async function vitalsForDoctor(doctorId: string, patientId: string, limit = 60) {
  return db.select().from(schema.vitals)
    .where(and(eq(schema.vitals.patientId, patientId), or(eq(schema.vitals.doctorId, doctorId), isNull(schema.vitals.doctorId))))
    .orderBy(desc(schema.vitals.date), desc(schema.vitals.createdAt)).limit(limit);
}
export async function vitalsForPatients(patientIds: string[], limit = 120) {
  if (!patientIds.length) return [];
  return db.select({ v: schema.vitals, doctorName: schema.doctors.name }).from(schema.vitals)
    .leftJoin(schema.doctors, eq(schema.doctors.id, schema.vitals.doctorId))
    .where(inArray(schema.vitals.patientId, patientIds))
    .orderBy(desc(schema.vitals.date), desc(schema.vitals.createdAt)).limit(limit);
}

/** চার্ট/তালিকার জন্য সাধারণ রূপ (ক্লায়েন্টে পাঠানো যায়) */
export type VitalRow = { id: string; date: string; sys: number | null; dia: number | null; pulse: number | null; sugar: number | null; sugarWhen: string | null; weight: number | null; note: string | null; by: string };
export const toRow = (v: Vital, by: string): VitalRow => ({
  id: v.id, date: v.date, sys: v.systolic, dia: v.diastolic, pulse: v.pulse,
  sugar: v.sugarX10 === null ? null : v.sugarX10 / 10, sugarWhen: v.sugarWhen,
  weight: v.weightX10 === null ? null : v.weightX10 / 10, note: v.note, by,
});

/** একই রোগীর একই তারিখে হুবহু একই রিডিং আগে আছে কিনা — দুবার সেভ এড়াতে */
export async function duplicateVital(patientId: string, v: { date: string; systolic: number | null; diastolic: number | null; pulse: number | null; sugarX10: number | null; weightX10: number | null }) {
  const rows = await db.select().from(schema.vitals).where(and(eq(schema.vitals.patientId, patientId), eq(schema.vitals.date, v.date)));
  return rows.some((r) => r.systolic === v.systolic && r.diastolic === v.diastolic && r.pulse === v.pulse && r.sugarX10 === v.sugarX10 && r.weightX10 === v.weightX10);
}
