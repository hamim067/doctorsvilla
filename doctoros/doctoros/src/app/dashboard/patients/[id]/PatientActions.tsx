"use client";
import { useActionState, useState } from "react";
import { Icon } from "@/components/Icons";
import { keepValues } from "@/components/keepValues";
import type { QState } from "../actions";

type Ch = { id: string; name: string; city: string };
type Act = (s: QState, fd: FormData) => Promise<QState>;

/** রোগীর কার্ডের তিনটা বড় বোতাম — চাপলে নিচে ছোট ফর্ম খোলে */
export function PatientActions({ chambers, action, canRx, minDate }: { chambers: Ch[]; action: Act; canRx: boolean; minDate: string }) {
  const [open, setOpen] = useState<"" | "today" | "direct" | "appointment">("");
  const [state, act, pending] = useActionState(action, undefined);
  const btn = (k: typeof open, icon: Parameters<typeof Icon>[0]["name"], title: string, sub: string, cls: string) => (
    <button type="button" className={`pc-act ${cls}${open === k ? " on" : ""}`} aria-expanded={open === k} onClick={() => setOpen(open === k ? "" : k)}>
      <span className="pc-act-ic"><Icon name={icon} size={22} /></span>
      <span className="col" style={{ gap: 0, textAlign: "left" }}><b>{title}</b><small>{sub}</small></span>
    </button>
  );
  const chamberField = chambers.length > 1 ? (
    <label className="field">চেম্বার<select className="input" name="chamberId" defaultValue={chambers[0]?.id}>{chambers.map((c) => <option key={c.id} value={c.id}>{c.name}, {c.city}</option>)}</select></label>
  ) : <input type="hidden" name="chamberId" value={chambers[0]?.id ?? ""} />;

  return (
    <div className="pc-actions-wrap">
      <div className="pc-actions">
        {btn("today", "bell", "আজকের সিরিয়ালে যোগ", "রোগী এখন চেম্বারে আছেন", "a1")}
        {canRx && btn("direct", "pill", "এখনই প্রেসক্রিপশন লিখুন", "সিরিয়াল ছাড়া সরাসরি", "a2")}
        {btn("appointment", "calendar", "পরের অ্যাপয়েন্টমেন্ট দিন", "তারিখ বেছে সিরিয়াল", "a3")}
      </div>
      {open && (
        <form className="pc-form" onSubmit={keepValues(act)} key={open}>
          <input type="hidden" name="mode" value={open} />
          {chamberField}
          {open === "appointment" && <label className="field">তারিখ<input className="input" type="date" name="date" min={minDate} defaultValue={minDate} required /></label>}
          {open === "direct" && (
            <label className="pc-check"><input type="checkbox" name="free" value="1" />ফি নেওয়া হয়নি (ফ্রি দেখা — আয়ের হিসাবে যোগ হবে না)</label>
          )}
          {state?.error && <p className="alert alert-error" role="alert">⚠ {state.error}</p>}
          {state?.ok && <p className="alert alert-ok" role="status">✓ {state.ok}</p>}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-primary" disabled={pending}>
              {pending ? "হচ্ছে…" : open === "today" ? "সিরিয়াল দিন" : open === "direct" ? "প্রেসক্রিপশন খুলুন" : "অ্যাপয়েন্টমেন্ট দিন"}
            </button>
            <button type="button" className="btn" onClick={() => setOpen("")}>বন্ধ</button>
          </div>
        </form>
      )}
    </div>
  );
}

/** অ্যালার্জি আর দীর্ঘমেয়াদি রোগ — দেখানো ও বদলানো */
export function HealthInfo({ allergies, conditions, action }: { allergies: string[]; conditions: string[]; action: Act }) {
  const [edit, setEdit] = useState(false);
  const [state, act, pending] = useActionState(async (s: QState, fd: FormData) => { const r = await action(s, fd); if (r?.ok) setEdit(false); return r; }, undefined);
  if (!edit) {
    return (
      <div className="pc-health">
        <div className="pc-tags">
          {allergies.map((a) => <span key={a} className="pc-tag red"><Icon name="alert" size={14} />অ্যালার্জি: {a}</span>)}
          {conditions.map((c) => <span key={c} className="pc-tag">{c}</span>)}
          {!allergies.length && !conditions.length && <span className="muted small">অ্যালার্জি বা দীর্ঘমেয়াদি রোগ লেখা নেই</span>}
        </div>
        <button type="button" className="btn btn-sm2" onClick={() => setEdit(true)}><Icon name="plus" size={16} />{allergies.length || conditions.length ? "বদলান" : "যোগ করুন"}</button>
      </div>
    );
  }
  return (
    <form className="pc-form" onSubmit={keepValues(act)}>
      <label className="field">অ্যালার্জি (কমা দিয়ে)<input className="input" name="allergies" defaultValue={allergies.join(", ")} placeholder="যেমন: পেনিসিলিন, সালফা, চিংড়ি" /></label>
      <label className="field">দীর্ঘমেয়াদি রোগ (কমা দিয়ে)<input className="input" name="conditions" defaultValue={conditions.join(", ")} placeholder="যেমন: ডায়াবেটিস, উচ্চ রক্তচাপ, অ্যাজমা" /></label>
      {state?.error && <p className="alert alert-error">⚠ {state.error}</p>}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-primary" disabled={pending}>{pending ? "সেভ হচ্ছে…" : "সেভ করুন"}</button>
        <button type="button" className="btn" onClick={() => setEdit(false)}>বাতিল</button>
      </div>
    </form>
  );
}
