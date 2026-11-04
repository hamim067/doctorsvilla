import { eq } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { PrintButton } from "@/components/PrintButton";
import { VisitingCard } from "@/components/VisitingCard";
import { requireDoctor } from "@/lib/auth";
import { normalizePad } from "@/lib/rxpad";
import { normalizeCard } from "@/lib/vcard";
import { buildCardData } from "@/lib/vcard-data";
import "../print.css";
import "../vcard.css";

export const metadata = { title: "ভিজিটিং কার্ড", robots: { index: false } };

/** A4-এ ১০টা কার্ড; পেছনের দিক চালু থাকলে দ্বিতীয় পাতায় উল্টো সাজানো (দুই পাশে ছাপানোর জন্য) */
export default async function CardPrint() {
  const s = await requireDoctor();
  const [d] = await db.select().from(schema.doctors).where(eq(schema.doctors.id, s.doctorId)).limit(1);
  const card = d.card ? normalizeCard(d.card) : { ...normalizeCard(null), color: normalizePad(d.rxPad).color };
  const data = await buildCardData(d);
  const ten = Array.from({ length: 10 }, (_, i) => i);
  return (
    <>
      <style>{`@page { size: A4; margin: 0; }`}</style>
      <div className="pr-bar">
        <Link href="/dashboard/share#card">← কার্ডের ডিজাইনে ফিরুন</Link>
        <span className="small muted">{card.back ? "২ পাতা: সামনে আর পেছন — প্রিন্টারে \"দুই পাশে (লম্বা দিকে উল্টে)\" বাছুন" : "এক পাতায় ১০টি — কাটার দাগ ধরে কাটুন"}</span>
        <PrintButton />
      </div>
      <div className="pr-desk">
        <div className="pr-paper vk-page"><div className="vk-sheet">{ten.map((i) => <VisitingCard key={i} s={card} d={data} />)}</div></div>
        {card.back && <div className="pr-paper vk-page"><div className="vk-sheet back">{ten.map((i) => <VisitingCard key={i} s={card} d={data} side="back" />)}</div></div>}
      </div>
    </>
  );
}
