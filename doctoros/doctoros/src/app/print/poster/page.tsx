import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { PrintButton } from "@/components/PrintButton";
import { requireDoctor } from "@/lib/auth";
import { qrSvg, siteOrigin } from "@/lib/qr";
import { bn, formatTimeBn, WEEKDAYS_BN } from "@/lib/time";
import "../print.css";

export const metadata = { title: "পোস্টার ও কার্ড", robots: { index: false } };

const sortWeek = (a: { weekday: number }, b: { weekday: number }) => ((a.weekday + 1) % 7) - ((b.weekday + 1) % 7);

export default async function PosterPage({ searchParams }: { searchParams: Promise<{ chamber?: string; card?: string }> }) {
  const s = await requireDoctor();
  const sp = await searchParams;
  const [d] = await db.select().from(schema.doctors).where(eq(schema.doctors.id, s.doctorId)).limit(1);
  const chambers = await db.query.chambers.findMany({
    where: and(eq(schema.chambers.doctorId, s.doctorId), eq(schema.chambers.active, true)),
    with: { schedules: true }, orderBy: asc(schema.chambers.createdAt),
  });
  const origin = await siteOrigin();
  const url = `${origin}/dr/${d.slug}`;
  const shortUrl = url.replace(/^https?:\/\//, "");

  if (sp.card) {
    const svg = await qrSvg(url);
    const main = chambers[0];
    return (
      <>
        <div className="pr-bar"><Link href="/dashboard/share?tab=print">← ফিরে যান</Link><span className="small muted">A4 কাগজে ১০টি কার্ড · ড্যাশ দাগ বরাবর কাটুন</span><PrintButton /></div>
        <div className="pr-desk"><div className="pr-a4 vc-sheet">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="vc">
              <div className="vc-l">
                <b>{d.name}</b>
                <span>{d.degrees}</span>
                <span>{d.specialty}</span>
                {main && <span>{main.name}, {main.address}, {main.city}</span>}
                <span className="vc-tag">অনলাইনে সিরিয়াল: {shortUrl}</span>
              </div>
              <div className="vc-qr"><div dangerouslySetInnerHTML={{ __html: svg }} /><small>স্ক্যান করে সিরিয়াল নিন</small></div>
            </div>
          ))}
        </div></div>
      </>
    );
  }

  const c = chambers.find((x) => x.id === sp.chamber) ?? chambers[0];
  if (!c) notFound();
  const bookUrl = `${origin}/dr/${d.slug}/book?chamber=${c.id}`;
  const svg = await qrSvg(bookUrl);
  return (
    <>
      <div className="pr-bar"><Link href="/dashboard/share?tab=print">← ফিরে যান</Link><span className="small muted">A4 পোস্টার · {c.name}</span><PrintButton /></div>
      <div className="pr-desk"><div className="pr-a4 po">
        <div className="po-top">
          <h1>লাইনে দাঁড়াতে হবে না</h1>
          <p>ফোনে সিরিয়াল নিন, বাসা থেকেই দেখুন এখন কত নম্বর চলছে</p>
        </div>
        <div className="po-mid">
          <div className="po-qr" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="po-steps">
            <div><b>১</b>ফোনের ক্যামেরা দিয়ে QR কোড স্ক্যান করুন</div>
            <div><b>২</b>তারিখ বেছে নাম আর মোবাইল নাম্বার দিন</div>
            <div><b>৩</b>এসএমএসে সিরিয়াল নাম্বার আর লাইভ লিংক পাবেন</div>
          </div>
        </div>
        <div className="po-doc">
          <h2>{d.name}</h2>
          <span className="sub">{d.degrees} · {d.specialty}</span>
          <span className="sub">{c.name}, {c.address}, {c.city} · নতুন রোগী ৳{bn(c.feeNew)}</span>
          <div className="po-times">
            {[...c.schedules].sort(sortWeek).map((x) => <span key={x.id}><b>{WEEKDAYS_BN[x.weekday]}</b> · {formatTimeBn(x.startTime)} – {formatTimeBn(x.endTime)}</span>)}
          </div>
        </div>
        <div className="po-foot">
          <span>QR কাজ না করলে ব্রাউজারে লিখুন:<br /><span className="po-url">{shortUrl}</span></span>
          <span>DoctorOS</span>
        </div>
      </div></div>
    </>
  );
}
