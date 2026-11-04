// প্রেসক্রিপশন প্যাডে বসানোর তথ্য জোগাড় — ডাক্তারের প্রিন্ট আর রোগীর কপি দুটোর জন্য
import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { patientCode } from "@/lib/booking";
import { doctorAssetUrls } from "@/lib/assets";
import { qrSvg, siteOrigin } from "@/lib/qr";
import { type PadData } from "@/lib/rxpad";
import { bn, formatDateBn, thisYear } from "@/lib/time";

type Visit = typeof schema.visits.$inferSelect;
type Doctor = typeof schema.doctors.$inferSelect;
type Patient = typeof schema.patients.$inferSelect;
type Chamber = typeof schema.chambers.$inferSelect;

/** সেদিনের রিডিং (প্রেসার, পালস, ওজন, তাপ, SpO₂) — সর্বশেষটা */
async function vitalsOn(patientId: string, date: string, doctorId?: string) {
  const rows = await db.select().from(schema.vitals)
    .where(and(eq(schema.vitals.patientId, patientId), eq(schema.vitals.date, date)))
    .orderBy(desc(schema.vitals.createdAt));
  const mine = doctorId ? rows.filter((r) => !r.doctorId || r.doctorId === doctorId) : rows;
  const pick = <K extends keyof (typeof rows)[number]>(k: K) => mine.find((r) => r[k] !== null)?.[k] ?? null;
  const sys = pick("systolic"), dia = pick("diastolic"), pulse = pick("pulse"), w = pick("weightX10"), t = pick("tempX10"), o = pick("spo2");
  const out: NonNullable<PadData["vitals"]> = {};
  if (sys !== null && dia !== null) out.bp = `${bn(sys as number)}/${bn(dia as number)}`;
  if (pulse !== null) out.pulse = `${bn(pulse as number)}/min`;
  if (w !== null) out.weight = `${bn((w as number) / 10)} kg`;
  if (t !== null) out.temp = `${bn((t as number) / 10)}°F`;
  if (o !== null) out.spo2 = `${bn(o as number)}%`;
  return Object.keys(out).length ? out : null;
}

export async function buildPadData(o: { doctor: Doctor; patient: Patient; chamber: Chamber | null; visit: Visit | null; date: string; serialNo?: number | null; forPatient?: boolean }): Promise<PadData> {
  const url = `${await siteOrigin()}/dr/${o.doctor.slug}`;
  return {
    doctor: { name: o.doctor.name, degrees: o.doctor.degrees, specialty: o.doctor.specialty, bmdcNo: o.doctor.bmdcNo },
    chamber: o.chamber ? { name: o.chamber.name, address: o.chamber.address, city: o.chamber.city } : null,
    patient: { name: o.patient.name, age: o.patient.birthYear ? thisYear() - o.patient.birthYear : null, gender: o.patient.gender, code: patientCode(o.patient.number) },
    date: `${formatDateBn(o.date, false)} ${bn(o.date.slice(0, 4))}`,
    serial: o.serialNo ? bn(o.serialNo) : null,
    visit: o.visit ? {
      complaint: o.visit.complaint, diagnosis: o.visit.diagnosis, medicines: o.visit.medicines, advice: o.visit.advice,
      investigations: o.visit.investigations, followUp: o.visit.followUpDate ? `${formatDateBn(o.visit.followUpDate, false)} ${bn(o.visit.followUpDate.slice(0, 4))}` : null,
    } : null,
    vitals: await vitalsOn(o.patient.id, o.date, o.forPatient ? undefined : o.doctor.id),
    qrSvg: await qrSvg(url),
    url,
    ...(await doctorAssetUrls(o.doctor.id, o.doctor.slug)),
  };
}
