import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireDoctor } from "@/lib/auth";
import { siteOrigin } from "@/lib/qr";
import { hasPremium, normalize, premiumFreeForAll, premiumOfferUntil } from "@/lib/site";
import { formatDateBn } from "@/lib/time";
import { WebsiteEditor } from "./WebsiteEditor";
import { doctorAssetUrls } from "@/lib/assets";
import "./website.css";

export const metadata = { title: "আমার ওয়েবসাইট" };
export const dynamic = "force-dynamic";

export default async function WebsitePage() {
  const s = await requireDoctor();
  const [doctor] = await db.select().from(schema.doctors).where(eq(schema.doctors.id, s.doctorId)).limit(1);
  const [site] = await db.select().from(schema.doctorSites).where(eq(schema.doctorSites.doctorId, s.doctorId)).limit(1);
  const chambers = await db.select({ id: schema.chambers.id, name: schema.chambers.name, city: schema.chambers.city })
    .from(schema.chambers).where(eq(schema.chambers.doctorId, s.doctorId)).orderBy(asc(schema.chambers.createdAt));
  const origin = (await siteOrigin()).replace(/^https?:\/\//, "");
  const until = premiumOfferUntil();
  const offer = premiumFreeForAll()
    ? `লঞ্চ অফার: Premium ওয়েবসাইট এখন সম্পূর্ণ ফ্রি${until ? ` (${formatDateBn(until, false)} পর্যন্ত)` : ""}`
    : null;

  return (
    <WebsiteEditor
      logoUrl={(await doctorAssetUrls(doctor.id, doctor.slug)).logoUrl ?? null}
      initial={normalize(site?.content, doctor)}
      published={site?.published ?? false}
      photo={site?.photo ?? null}
      premium={hasPremium(doctor)}
      offer={offer}
      doctor={{ name: doctor.name, degrees: doctor.degrees, bmdcNo: doctor.bmdcNo, slug: doctor.slug, experienceYears: doctor.experienceYears }}
      chambers={chambers}
      link={`${origin}/dr/${doctor.slug}`}
    />
  );
}
