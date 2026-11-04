"use client";
import { useActionState, useState } from "react";
import { bookOnline } from "@/app/dr/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { keepValues } from "@/components/keepValues";

type Day = {
  date: string; open: boolean; onlineLeft: number; nextSerial: number;
  startTime?: string; top: string; num: string; sub: string; long: string; startLabel: string;
};

const bn = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);

/** "18:00" + মিনিট → "সন্ধ্যা ৭:২০" */
function addMinutes(hhmm: string, min: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const tot = h * 60 + m + min;
  const H = Math.floor(tot / 60) % 24, M = tot % 60;
  const part = H < 12 ? "সকাল" : H < 15 ? "দুপুর" : H < 18 ? "বিকাল" : H < 20 ? "সন্ধ্যা" : "রাত";
  return `${part} ${bn(H % 12 === 0 ? 12 : H % 12)}:${bn(String(M).padStart(2, "0"))}`;
}

type Family = { id: string; name: string; relation: string | null }[];

export function BookForm({ chamberId, days, avgMinutes, summary, patient, wantDate, wantMember }: {
  chamberId: string; days: Day[]; avgMinutes: number; wantDate?: string; wantMember?: string;
  patient: { phone: string; family: Family } | null;
  summary: { doctor: string; chamber: string; feeNew: number; feeFollowUp: number };
}) {
  const [state, action, pending] = useActionState(bookOnline, undefined);
  // ফলোআপের দিন থেকে এলে সেই দিনটা (বা তার পরের প্রথম খোলা দিন) আগে থেকেই বাছা
  const okDay = (d: Day) => d.open && d.onlineLeft > 0;
  const firstOpen = (wantDate && (days.find((d) => d.date >= wantDate && okDay(d))?.date)) || days.find(okDay)?.date || "";
  const [picked, setPicked] = useState(firstOpen);
  const fam = patient?.family ?? [];
  const [member, setMember] = useState((wantMember && fam.find((f) => f.id === wantMember)?.id) || fam[0]?.id || "new");
  const [name, setName] = useState("");
  const chosen = fam.find((f) => f.id === member);
  const shownName = chosen ? chosen.name : name;
  const day = days.find((d) => d.date === picked);
  const eta = day?.startTime ? `${addMinutes(day.startTime, (day.nextSerial - 1) * avgMinutes)} – ${addMinutes(day.startTime, (day.nextSerial - 1) * avgMinutes + 20)}` : "";

  return (
    <form onSubmit={keepValues(action)} className="pt-stack">
      <input type="hidden" name="chamberId" value={chamberId} />

      <fieldset className="pt-sec" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="pt-h2">তারিখ বেছে নিন</legend>
        {!firstOpen && <p className="muted">আগামী ১৪ দিনে এই চেম্বারে অনলাইন সিরিয়াল খালি নেই।</p>}
        <div className="pt-days">
          {days.map((d) => {
            const disabled = !d.open || d.onlineLeft <= 0;
            return (
              <label key={d.date} className="pt-day">
                <input type="radio" name="date" value={d.date} checked={picked === d.date} onChange={() => setPicked(d.date)} disabled={disabled} required />
                <span className="xs">{d.top}</span>
                <b>{d.num}</b>
                <span className="xs">{d.sub}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {day && (
        <section className="pt-sec">
          <div className="row-sb"><h2>সিরিয়াল</h2><span className="small muted">পরের খালি সিরিয়াল আপনার</span></div>
          <div className="pt-serial">
            <span className="pt-serial-n">{bn(day.nextSerial)}</span>
            <span className="col" style={{ gap: 2 }}>
              <b>আপনার সিরিয়াল হবে আনুমানিক {bn(day.nextSerial)}</b>
              {eta && <span className="small muted">আনুমানিক ডাক পড়বে {eta}</span>}
            </span>
          </div>
        </section>
      )}

      <section className="pt-card pt-stack-sm">
        <h2 className="pt-h2">{fam.length ? "কার জন্য?" : "রোগীর তথ্য"}</h2>
        {fam.length > 0 && (
          <div className="pt-who" role="radiogroup" aria-label="কার জন্য">
            {fam.map((f) => (
              <label key={f.id} className={member === f.id ? "on" : ""}>
                <input type="radio" name="patientId" value={f.id} checked={member === f.id} onChange={() => setMember(f.id)} />
                {f.name}{f.relation ? ` (${f.relation})` : ""}
              </label>
            ))}
            <label className={member === "new" ? "on new" : "new"}>
              <input type="radio" name="patientId" value="new" checked={member === "new"} onChange={() => setMember("new")} />+ নতুন
            </label>
          </div>
        )}
        {member === "new" && (
          <>
            <label className="field">রোগীর নাম<input className="input" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required /></label>
            {patient ? (
              <input type="hidden" name="phone" value={patient.phone} />
            ) : (
              <label className="field">মোবাইল নাম্বার<input className="input" name="phone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="01XXXXXXXXX" required />
                <span className="muted small" style={{ fontWeight: 400 }}>এই নাম্বারে সিরিয়াল ও রিমাইন্ডার যাবে। পরিবারের অন্য কারও জন্যও একই নাম্বার দিতে পারেন।</span></label>
            )}
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <label className="field">লিঙ্গ<select className="input" name="gender" defaultValue=""><option value="">—</option><option>পুরুষ</option><option>মহিলা</option><option>অন্যান্য</option></select></label>
              <label className="field">বয়স<input className="input" name="age" type="text" inputMode="numeric" /></label>
            </div>
          </>
        )}
        {patient && <span className="small muted">এসএমএস যাবে {patient.phone} নাম্বারে।</span>}
      </section>

      {day && (
        <section className="pt-summary">
          <div className="pt-summary-top"><b>{summary.doctor}</b><span className="small muted">{summary.chamber}</span></div>
          <div className="pt-summary-grid">
            <span><small>রোগী</small><b>{shownName.trim() || "—"}</b></span>
            <span><small>তারিখ</small><b>{day.long}</b></span>
            <span><small>সিরিয়াল</small><b className="teal">আনুমানিক {bn(day.nextSerial)}</b></span>
            <span><small>ফি (চেম্বারে)</small><b>৳{bn(summary.feeNew)}</b></span>
          </div>
          <p className="small muted" style={{ padding: "0 16px 14px" }}>কনফার্ম করলে এসএমএসে সিরিয়াল নাম্বার আর লাইভ ট্র্যাকিং লিংক যাবে। অনলাইন পেমেন্ট (bKash/Nagad) শীঘ্রই আসছে।</p>
        </section>
      )}

      {state?.error && <p className="alert alert-error" role="alert">{state.error}</p>}
      <div className="pt-bottom">
        <div className="pt-wrap">
          <SubmitButton pending={pending} className="pt-cta" disabled={!firstOpen}>সিরিয়াল কনফার্ম করুন</SubmitButton>
        </div>
      </div>
    </form>
  );
}
