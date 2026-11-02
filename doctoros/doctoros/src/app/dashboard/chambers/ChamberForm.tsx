"use client";
import { useActionState, useEffect, useRef } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { keepValues } from "@/components/keepValues";
import type { FormState } from "@/lib/form";

const DAYS = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
const ORDER = [6, 0, 1, 2, 3, 4, 5]; // শনিবার থেকে শুরু

type Chamber = {
  id?: string; name?: string; code?: string; address?: string; city?: string;
  feeNew?: number; feeFollowUp?: number; avgMinutes?: number; dailyLimit?: number; onlineSharePct?: number;
  schedules?: { weekday: number; startTime: string; endTime: string }[];
};

export function ChamberForm({ action, chamber, submitLabel }: { action: (s: FormState, fd: FormData) => Promise<FormState>; chamber?: Chamber; submitLabel: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const sched = new Map((chamber?.schedules ?? []).map((s) => [s.weekday, s]));
  const isNew = !chamber?.id;
  // বাটনের পাশে ফলাফল দেখাই আর সেখানে স্ক্রল করি — যাতে লম্বা ফর্মে error চোখ এড়িয়ে না যায়
  const msgRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state) msgRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state]);
  return (
    <form onSubmit={keepValues(formAction)} className="stack">
      {chamber?.id && <input type="hidden" name="id" value={chamber.id} />}

      <div className="card stack">
        <h2>চেম্বারের তথ্য</h2>
        <div className="grid">
          <label className="field">চেম্বারের নাম<input className="input" name="name" defaultValue={chamber?.name} placeholder="শাপলা মেডিকেয়ার" required /></label>
          <label className="field">চেম্বার কোড (ঐচ্ছিক)<input className="input" name="code" defaultValue={chamber?.code} placeholder="যেমন RAJ — খালি রাখলে নিজে তৈরি হবে" maxLength={5} style={{ textTransform: "uppercase" }} />
            <span className="muted small" style={{ fontWeight: 400 }}>রোগীর সিরিয়াল কোডে বসে: RAJ-1102-07</span></label>
        </div>
        <div className="grid">
          <label className="field">ঠিকানা<input className="input" name="address" defaultValue={chamber?.address} required /></label>
          <label className="field">শহর<input className="input" name="city" defaultValue={chamber?.city} placeholder="রাজশাহী" required /></label>
        </div>
        <div className="grid">
          <label className="field">নতুন রোগীর ফি (৳)<input className="input" name="feeNew" type="text" inputMode="numeric" defaultValue={chamber?.feeNew} required /></label>
          <label className="field">ফলোআপ ফি (৳)<input className="input" name="feeFollowUp" type="text" inputMode="numeric" defaultValue={chamber?.feeFollowUp} required /></label>
          <label className="field">প্রতি রোগী গড় সময় (মিনিট)<input className="input" name="avgMinutes" type="text" inputMode="numeric" defaultValue={chamber?.avgMinutes ?? 10} /></label>
        </div>
        <div className="grid">
          <label className="field">দিনে সর্বোচ্চ রোগী<input className="input" name="dailyLimit" type="text" inputMode="numeric" defaultValue={chamber?.dailyLimit ?? 30} /></label>
          <label className="field">অনলাইন সিরিয়ালের অংশ (%)<input className="input" name="onlineSharePct" type="text" inputMode="numeric" defaultValue={chamber?.onlineSharePct ?? 60} />
            <span className="muted small" style={{ fontWeight: 400 }}>বাকিটা সরাসরি আসা রোগীদের জন্য থাকবে</span></label>
        </div>
      </div>

      <div className="card stack-sm">
        <h2>সাপ্তাহিক সময়সূচি</h2>
        {ORDER.map((d) => {
          const s = sched.get(d);
          const open = s ? true : isNew ? d !== 5 : false; // নতুন চেম্বারে শুক্রবার বাদে সব খোলা
          return (
            <div key={d} className="row" style={{ borderTop: "1px solid var(--row-line)", paddingTop: 8 }}>
              <label className="row" style={{ width: 150, fontWeight: 600, gap: 8 }}>
                <input type="checkbox" name={`open-${d}`} defaultChecked={open} style={{ width: 20, height: 20 }} />{DAYS[d]}
              </label>
              <label className="row small" style={{ gap: 6 }}>শুরু<input className="input" type="time" name={`start-${d}`} defaultValue={s?.startTime ?? "18:00"} style={{ width: 130 }} /></label>
              <label className="row small" style={{ gap: 6 }}>শেষ<input className="input" type="time" name={`end-${d}`} defaultValue={s?.endTime ?? "21:00"} style={{ width: 130 }} /></label>
            </div>
          );
        })}
      </div>
      <div ref={msgRef} className="stack-sm">
        {state?.error && <p className="alert alert-error" role="alert">⚠ {state.error}</p>}
        {state?.ok && <p className="alert alert-ok" role="status">✓ {state.ok}</p>}
        <div><SubmitButton pending={pending} className="btn btn-primary btn-big">{submitLabel}</SubmitButton></div>
      </div>
    </form>
  );
}
