import "server-only";
import { doctorAssetUrls } from "@/lib/assets";
import { doctorChambers } from "@/lib/chambers";
import { qrSvg, siteOrigin } from "@/lib/qr";
import { normalizePad } from "@/lib/rxpad";
import { loadSite } from "@/lib/site";
import { linesFor } from "@/lib/site-data";
import type { CardData } from "@/lib/vcard";
import type { Doctor } from "@/db/schema";

/** ভিজিটিং কার্ডের তথ্য — প্রোফাইল, চেম্বার, প্যাড ও ওয়েবসাইটে আগে লেখা তথ্য থেকেই (আবার লিখতে হয় না) */
export async function buildCardData(d: Doctor): Promise<CardData> {
  const url = `${await siteOrigin()}/dr/${d.slug}`;
  const pad = normalizePad(d.rxPad);
  const [chs, site, assets] = await Promise.all([doctorChambers(d.id), loadSite(d.id), doctorAssetUrls(d.id, d.slug)]);
  const sc = (site?.content ?? {}) as { hotline?: string; email?: string };
  return {
    name: d.name, degrees: d.degrees, specialty: d.specialty, bmdcNo: d.bmdcNo,
    phone: pad.phone || sc.hotline || "", website: pad.website, email: pad.email || sc.email || "", hospital: pad.hospital,
    chambers: chs.map((c) => ({ name: c.name, city: c.city, address: c.address, schedule: linesFor(c.schedules, "bn")[0] ?? "" })),
    qrSvg: await qrSvg(url), logoUrl: assets.logoUrl ?? null, url,
  };
}
