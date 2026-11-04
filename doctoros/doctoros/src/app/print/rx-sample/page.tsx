import { eq } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { PrintButton } from "@/components/PrintButton";
import { RxPad } from "@/components/RxPad";
import { requireDoctor } from "@/lib/auth";
import { doctorChambers } from "@/lib/chambers";
import { qrSvg, siteOrigin } from "@/lib/qr";
import { doctorAssetUrls } from "@/lib/assets";
import { normalizePad, sampleData } from "@/lib/rxpad";
import "../print.css";
import "../rxpad.css";

export const metadata = { title: "প্রেসক্রিপশন প্যাড", robots: { index: false } };

/** নমুনা প্রিন্ট (?blank=1 দিলে খালি প্যাড — হাতে লেখার জন্য ছাপানো যায়) */
export default async function RxSample({ searchParams }: { searchParams: Promise<{ blank?: string }> }) {
  const s = await requireDoctor();
  const blank = (await searchParams).blank === "1";
  const [d] = await db.select().from(schema.doctors).where(eq(schema.doctors.id, s.doctorId)).limit(1);
  const ch = (await doctorChambers(s.doctorId))[0];
  const url = `${await siteOrigin()}/dr/${d.slug}`;
  const pad = normalizePad(d.rxPad);
  const base = sampleData({ name: d.name, degrees: d.degrees, specialty: d.specialty, bmdcNo: d.bmdcNo }, ch ? { name: ch.name, address: ch.address, city: ch.city } : null);
  const assets = await doctorAssetUrls(d.id, d.slug);
  const data = blank
    ? { ...base, patient: { name: "", age: null, gender: null, code: "" }, date: "", serial: null, visit: null, vitals: null, qrSvg: await qrSvg(url), url, ...assets }
    : { ...base, qrSvg: await qrSvg(url), url, ...assets };
  return (
    <>
      <style>{`@page { size: ${pad.paper}; margin: 0; }`}</style>
      <div className="pr-bar">
        <Link href="/dashboard/share#pad">← ডিজাইনে ফিরুন</Link>
        <span className="small muted">{blank ? "খালি প্যাড — ছাপিয়ে হাতে লেখার জন্য" : "নমুনা রোগী দিয়ে দেখানো"}</span>
        <PrintButton />
      </div>
      <div className="pr-desk"><div className="pr-paper"><RxPad s={blank ? { ...pad, sections: { ...pad.sections, vitals: false } } : pad} d={data} /></div></div>
    </>
  );
}
