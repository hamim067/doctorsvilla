"use client";
import { useActionState } from "react";
import { bookOnline } from "@/app/dr/actions";
import { SubmitButton } from "@/components/SubmitButton";

type Day = { date: string; open: boolean; onlineLeft: number; label: string; sub: string };

export function BookForm({ chamberId, days }: { chamberId: string; days: Day[] }) {
  const [state, action] = useActionState(bookOnline, undefined);
  const firstOpen = days.find((d) => d.open && d.onlineLeft > 0)?.date;
  return (
    <form action={action} className="stack">
      <input type="hidden" name="chamberId" value={chamberId} />
      {state?.error && <p className="alert alert-error" role="alert">{state.error}</p>}
      <fieldset className="card stack-sm" style={{ border: "1px solid var(--line)" }}>
        <legend style={{ fontWeight: 700, padding: "0 4px" }}>তারিখ বেছে নিন</legend>
        {!firstOpen && <p className="muted">আগামী ১৪ দিনে এই চেম্বারে অনলাইন সিরিয়াল খালি নেই।</p>}
        <div className="chip-row">
          {days.map((d) => {
            const disabled = !d.open || d.onlineLeft <= 0;
            return (
              <label key={d.date} className="chip">
                <input type="radio" name="date" value={d.date} defaultChecked={d.date === firstOpen} disabled={disabled} required />
                <span className="small">{d.label}</span>
                <span className="small" style={{ fontSize: 12, opacity: 0.85 }}>{d.sub}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="card stack">
        <strong>রোগীর তথ্য</strong>
        <label className="field">রোগীর নাম<input className="input" name="name" autoComplete="name" required /></label>
        <label className="field">মোবাইল নাম্বার<input className="input" name="phone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="01XXXXXXXXX" required />
          <span className="muted small" style={{ fontWeight: 400 }}>এই নাম্বারে সিরিয়াল নাম্বার ও রিমাইন্ডার যাবে। পরিবারের অন্য কারও জন্যও একই নাম্বার দিতে পারেন।</span></label>
        <div className="grid">
          <label className="field">লিঙ্গ<select className="input" name="gender" defaultValue=""><option value="">—</option><option>পুরুষ</option><option>মহিলা</option><option>অন্যান্য</option></select></label>
          <label className="field">বয়স<input className="input" name="age" type="number" min={0} max={120} inputMode="numeric" /></label>
        </div>
      </div>
      <p className="muted small">ফি চেম্বারে পরিশোধ করবেন। অনলাইন পেমেন্ট (bKash/Nagad) পরের ভার্সনে আসছে।</p>
      <SubmitButton className="btn btn-primary btn-big btn-block" disabled={!firstOpen}>সিরিয়াল কনফার্ম করুন</SubmitButton>
    </form>
  );
}
