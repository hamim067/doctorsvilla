import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { requireDoctor } from "@/lib/auth";
import { loadSite } from "@/lib/site";
import { websiteData } from "@/lib/site-data";
import "../dr/site.css";
import "@fontsource/anek-bangla/400.css";
import "@fontsource/anek-bangla/500.css";
import "@fontsource/anek-bangla/600.css";
import "@fontsource/anek-bangla/700.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import { LivePreview } from "./LivePreview";

export const metadata = { title: "প্রিভিউ", robots: { index: false } };
export const dynamic = "force-dynamic";

/** এডিটরের ডানের লাইভ প্রিভিউ (iframe) — শুধু লগইন করা ডাক্তার, সেভ না করা লেখাও দেখায় */
export default async function SitePreview() {
  const s = await requireDoctor();
  const [doctor] = await db.select().from(schema.doctors).where(eq(schema.doctors.id, s.doctorId)).limit(1);
  if (!doctor) notFound();
  const chambers = await db.query.chambers.findMany({
    where: and(eq(schema.chambers.doctorId, doctor.id), eq(schema.chambers.active, true)),
    with: { schedules: true },
    orderBy: asc(schema.chambers.createdAt),
  });
  const site = await loadSite(doctor.id);
  const d = await websiteData({ doctor, chambers, site }, null);
  return <LivePreview initial={d} />;
}
