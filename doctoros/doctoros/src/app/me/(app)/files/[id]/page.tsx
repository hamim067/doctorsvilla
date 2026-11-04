import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { Icon } from "@/components/Icons";
import { ScaledPad } from "@/components/ScaledPad";
import { addDays, bn, formatDateBn, today } from "@/lib/time";
import { parseDays, parseDose, type Slot } from "@/lib/meds";
import { familyOf, requirePatient } from "@/lib/patient-auth";
import { memberRx } from "@/lib/patient-rx";
import { normalizePad } from "@/lib/rxpad";
import { buildPadData } from "@/lib/rxpad-data";
import { toRow } from "@/lib/vitals";
import "../../../../print/rxpad.css";
import "../../rx.css";

export const metadata = { title: "প্রেসক্রিপশন" };
export const dynamic = "force-dynamic";

const SLOTS: { k: Slot; label: string; icon: "sun" | "moon"; cls: string }[] = [
  { k: "morning", label: "সকাল", icon: "sun", cls: "s1" },
  { k: "noon", label: "দুপুর", icon: "sun", cls: "s2" },
  { k: "night", label: "রাত", icon: "moon", cls: "s3" },
];
const qty = (n: number) => (n === 0.5 ? "আধা" : bn(n));
const meal = (w: string) => (/আগে|before|খালি পেট/i.test(w) ? "before" : /পরে|after/i.test(w) ? "after" : null);

/** একটা প্রেসক্রিপশন — "সহজভাবে" (সকাল-দুপুর-রাত) আর "প্যাডের মতো" (ডাক্তারের ডিজাইন) */
export default async function RxDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> }) {
  const s = await requirePatient();
  const { id } = await params;
  const view = (await searchParams).view === "pad" ? "pad" : "easy";
  const fam = await familyOf(s.accountId);
  const [row] = await db.select({ v: schema.visits, date: schema.bookings.date, d: schema.doctors, chamber: schema.chambers })
    .from(schema.visits).innerJoin(schema.doctors, eq(schema.doctors.id, schema.visits.doctorId))
    .leftJoin(schema.bookings, eq(schema.bookings.id, schema.visits.bookingId))
    .leftJoin(schema.chambers, eq(schema.chambers.id, schema.bookings.chamberId))
    .where(eq(schema.visits.id, id)).limit(1);
  const p = row && fam.find((f) => f.id === row.v.patientId);
  if (!row || !p) notFound();
  const { v, d, chamber } = row;
  const list = await memberRx(p.id);
  const date = list.find((x) => x.v.id === v.id)?.date ?? row.date!;
  const idx = list.findIndex((x) => x.v.id === v.id);
  const newer = list[idx - 1], older = list[idx + 1];
  const t = today();
  const vit = (await db.select().from(schema.vitals).where(and(eq(schema.vitals.patientId, p.id), eq(schema.vitals.date, date)))).map((x) => toRow(x, ""))[0];
  const dx = v.diagnosis || v.complaint;
  const fuPast = v.followUpDate ? v.followUpDate < t : false;
  const bookHref = `/dr/${d.slug}/book?${new URLSearchParams({ ...(chamber ? { chamber: chamber.id } : {}), ...(v.followUpDate && !fuPast ? { date: v.followUpDate } : {}), member: p.id })}`;
  const share = [`প্রেসক্রিপশন — ${p.name}`, `${d.name} · ${formatDateBn(date)}`, dx ? `রোগ নির্ণয়: ${dx}` : "",
    ...v.medicines.map((m, j) => `${bn(j + 1)}. ${m.name} — ${[m.dose, m.when, m.days].filter(Boolean).join(", ")}`),
    v.advice ? `পরামর্শ: ${v.advice}` : "", v.followUpDate ? `আবার দেখানোর দিন: ${formatDateBn(v.followUpDate)}` : ""].filter(Boolean).join("\n");

  return (
    <div className="md rxd">
      <Link href="/me/files" className="rxd-back"><Icon name="chevron" size={18} />সব প্রেসক্রিপশন</Link>

      <header className="rxd-h">
        <span className="rxd-av"><Icon name="steth" size={24} /></span>
        <span className="col" style={{ gap: 2, minWidth: 0, flex: 1 }}>
          <b>{d.name}</b>
          <small>{d.degrees} · {d.specialty}</small>
          <small>{formatDateBn(date)} {bn(date.slice(0, 4))}{chamber ? ` · ${chamber.name}` : ""} · রোগী: {p.name}</small>
        </span>
      </header>

      <nav className="md-tabs" aria-label="দেখার ধরন">
        <Link href="?view=easy" className={view === "easy" ? "on" : ""} scroll={false}>সহজভাবে</Link>
        <Link href="?view=pad" className={view === "pad" ? "on" : ""} scroll={false}>প্যাডের মতো</Link>
      </nav>

      {view === "easy" ? (
        <>
          {dx && <section className="md-card rxd-dx"><span>রোগ নির্ণয়</span><b>{dx}</b>{v.diagnosis && v.complaint && <small>সমস্যা: {v.complaint}</small>}</section>}

          {v.medicines.length > 0 && (
            <section className="md-card">
              <h2 className="rxd-t"><Icon name="pill" size={20} />ওষুধ — কখন কোনটা খাবেন</h2>
              <ol className="rxd-meds">
                {v.medicines.map((m, j) => {
                  const sl = parseDose(m.dose);
                  const total = parseDays(m.days);
                  const end = total && total !== Infinity ? addDays(date, total - 1) : null;
                  const done = end ? end < t : false;
                  const ml = meal(m.when);
                  return (
                    <li key={j} className={done ? "done" : ""}>
                      <div className="rxd-mh"><span className="rxd-n">{bn(j + 1)}</span><b>{m.name}</b></div>
                      {sl ? (
                        <div className="rxd-slots">
                          {SLOTS.map((x) => (
                            <span key={x.k} className={`rxd-slot ${x.cls}${sl[x.k] > 0 ? " on" : ""}`}>
                              <Icon name={x.icon} size={18} /><small>{x.label}</small><b>{sl[x.k] > 0 ? `${qty(sl[x.k])}টা` : "—"}</b>
                            </span>
                          ))}
                        </div>
                      ) : m.dose ? <p className="rxd-raw">কীভাবে খাবেন: <b>{m.dose}</b></p> : null}
                      <div className="rxd-meta">
                        {ml && <span className={`rxd-meal ${ml}`}>{ml === "before" ? "খাবারের আগে" : "খাবারের পরে"}</span>}
                        {m.when && !ml && <span>{m.when}</span>}
                        {m.when && ml && m.when.replace(/খাবারের (আগে|পরে)/, "").trim() && <span>{m.when}</span>}
                        <span className="rxd-days">
                          {total === Infinity ? "নিয়মিত চলবে — ডাক্তার বন্ধ না বলা পর্যন্ত" : end ? (done ? `শেষ হয়ে গেছে (${formatDateBn(end, false)})` : `${m.days} — শেষ হবে ${formatDateBn(end, false)}`) : m.days || "কত দিন — লেখা নেই"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <p className="rxd-warn"><Icon name="alert" size={16} />ডাক্তারের পরামর্শ ছাড়া ওষুধ বন্ধ করবেন না বা বদলাবেন না।</p>
            </section>
          )}

          {(v.advice || v.investigations) && (
            <div className="rxd-two">
              {v.advice && <section className="md-card"><h2 className="rxd-t"><Icon name="check" size={20} />পরামর্শ</h2><p className="pre rxd-p">{v.advice}</p></section>}
              {v.investigations && (
                <section className="md-card"><h2 className="rxd-t"><Icon name="micro" size={20} />যে পরীক্ষা করাতে হবে</h2>
                  <ul className="rxd-inv">{v.investigations.split(/[,\n]/).map((x) => x.trim()).filter(Boolean).map((x) => <li key={x}>{x}</li>)}</ul>
                  <small className="muted">রিপোর্ট নিয়ে পরের বার ডাক্তারকে দেখাবেন।</small>
                </section>
              )}
            </div>
          )}

          {vit && (vit.sys !== null || vit.sugar !== null || vit.weight !== null || vit.pulse !== null) && (
            <section className="md-card"><h2 className="rxd-t"><Icon name="heart" size={20} />সেদিনের মাপ</h2>
              <div className="rxd-vit">
                {vit.sys !== null && <span><small>প্রেসার</small><b>{bn(vit.sys)}/{bn(vit.dia!)}</b></span>}
                {vit.pulse !== null && <span><small>পালস</small><b>{bn(vit.pulse)}</b></span>}
                {vit.sugar !== null && <span><small>সুগার</small><b>{bn(vit.sugar)}</b></span>}
                {vit.weight !== null && <span><small>ওজন</small><b>{bn(vit.weight)} kg</b></span>}
              </div>
            </section>
          )}
        </>
      ) : (
        <section className="rxd-pad"><ScaledPad s={normalizePad(d.rxPad)} d={await buildPadData({ doctor: d, patient: p, chamber: chamber ?? null, visit: v, date, forPatient: true })} /></section>
      )}

      <section className={`rxd-fu${fuPast ? " past" : ""}`}>
        <Icon name="calendar" size={24} />
        <span className="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
          {v.followUpDate ? (fuPast ? <><b>আবার দেখানোর দিন পার হয়ে গেছে</b><small>{formatDateBn(v.followUpDate)} ছিল — যত তাড়াতাড়ি পারেন দেখিয়ে নিন</small></> : <><b>আবার দেখানোর দিন: {formatDateBn(v.followUpDate)}</b><small>এখনই সিরিয়াল নিয়ে রাখুন</small></>)
            : <><b>আবার দেখাতে চান?</b><small>{d.name}-এর কাছে সিরিয়াল নিন</small></>}
        </span>
        <a className="btn btn-primary" href={bookHref}>সিরিয়াল নিন</a>
      </section>

      <div className="rxd-acts">
        <a className="btn" href={`/me/rx/${v.id}`} target="_blank" rel="noreferrer"><Icon name="external" size={16} />প্রিন্ট / PDF</a>
        <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer"><Icon name="chat" size={16} />WhatsApp-এ পাঠান</a>
      </div>

      {(newer || older) && (
        <nav className="rxd-nav" aria-label="অন্য প্রেসক্রিপশন">
          {older ? <Link href={`/me/files/${older.v.id}?view=${view}`}><Icon name="chevron" size={18} /><span><small>আগেরটা</small>{formatDateBn(older.date, false)} {bn(older.date.slice(0, 4))}</span></Link> : <span />}
          {newer ? <Link href={`/me/files/${newer.v.id}?view=${view}`} className="r"><span><small>পরেরটা</small>{formatDateBn(newer.date, false)} {bn(newer.date.slice(0, 4))}</span><Icon name="chevron" size={18} /></Link> : <span />}
        </nav>
      )}
    </div>
  );
}
