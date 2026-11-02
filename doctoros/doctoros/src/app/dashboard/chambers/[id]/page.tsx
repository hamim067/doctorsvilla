import { and, asc, eq, gte } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { requireDoctor } from "@/lib/auth";
import { formatDateBn, today } from "@/lib/time";
import { removeHoliday, setChamberActive, updateChamber } from "../actions";
import { ChamberForm } from "../ChamberForm";
import { HolidayForm } from "./HolidayForm";

export default async function ChamberEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const s = await requireDoctor();
  const { id } = await params;
  const { saved } = await searchParams;
  const chamber = await db.query.chambers.findFirst({
    where: and(eq(schema.chambers.id, id), eq(schema.chambers.doctorId, s.doctorId)),
    with: { schedules: true },
  });
  if (!chamber) notFound();
  const hols = await db
    .select()
    .from(schema.holidays)
    .where(and(eq(schema.holidays.chamberId, id), gte(schema.holidays.date, today())))
    .orderBy(asc(schema.holidays.date));
  return (
    <>
      <Link href="/dashboard/chambers" className="small">← সব চেম্বার</Link>
      <div className="row between">
        <h1>{chamber.name}</h1>
        <a className="btn" href={`/tv/${chamber.tvToken}`} target="_blank" rel="noreferrer">টিভি ডিসপ্লে খুলুন ↗</a>
      </div>
      {!chamber.active && <p className="alert alert-error">এই চেম্বার এখন বন্ধ — রোগীরা অনলাইনে দেখতে বা সিরিয়াল নিতে পারছেন না।</p>}
      {saved && <p className="alert alert-ok">চেম্বার যোগ হয়েছে। এখন রোগীরা অনলাইনে সিরিয়াল নিতে পারবেন।</p>}
      <ChamberForm action={updateChamber} chamber={chamber} submitLabel="সেভ করুন" />
      <div className="card card-warn stack">
        <h2>ছুটি / চেম্বার বন্ধ</h2>
        <p className="small">ছুটি যোগ করলে ওই দিনের বুক করা সব রোগীকে স্বয়ংক্রিয় এসএমএস যাবে, আর তাদের সিরিয়াল বাতিল হবে।</p>
        {hols.map((h) => (
          <form key={h.id} action={removeHoliday} className="row between" style={{ background: "#fff", padding: "8px 12px", borderRadius: 10 }}>
            <input type="hidden" name="id" value={h.id} /><input type="hidden" name="chamberId" value={id} />
            <span>{formatDateBn(h.date)}{h.note ? ` · ${h.note}` : ""}</span>
            <button className="btn" style={{ minHeight: 36 }}>মুছুন</button>
          </form>
        ))}
        <HolidayForm chamberId={id} min={today()} />
      </div>
      <form action={setChamberActive} className="card row between">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="active" value={chamber.active ? "0" : "1"} />
        <span className="stack-sm" style={{ gap: 2 }}>
          <strong>{chamber.active ? "চেম্বার স্থায়ীভাবে বন্ধ করুন" : "চেম্বার আবার চালু করুন"}</strong>
          <span className="muted small">{chamber.active ? "এখানে আর না বসলে বন্ধ করুন। আগের রোগী ও প্রেসক্রিপশন থেকে যাবে।" : "চালু করলে রোগীরা আবার অনলাইনে সিরিয়াল নিতে পারবেন।"}</span>
        </span>
        <button className={chamber.active ? "btn" : "btn btn-primary"}>{chamber.active ? "বন্ধ করুন" : "চালু করুন"}</button>
      </form>
    </>
  );
}
