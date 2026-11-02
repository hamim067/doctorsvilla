"use client";
import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { addWalkIn } from "./actions";

/** নতুন রোগী যোগ করে আজকের সিরিয়াল */
export function WalkInForm({ chamberId, phone }: { chamberId: string; phone?: string }) {
  const [state, action] = useActionState(addWalkIn, undefined);
  return (
    <form action={action} className="card stack">
      <h2>নতুন রোগী (সরাসরি আসা)</h2>
      <input type="hidden" name="chamberId" value={chamberId} />
      {state?.error && <p className="alert alert-error" role="alert">{state.error}</p>}
      {state?.ok && <p className="alert alert-ok" role="status">✓ {state.ok}</p>}
      <label className="field">মোবাইল নাম্বার<input className="input" name="phone" type="tel" inputMode="numeric" defaultValue={phone} required /></label>
      <label className="field">রোগীর নাম<input className="input" name="name" required /></label>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <label className="field">বয়স<input className="input" name="age" type="number" min={0} max={120} /></label>
        <label className="field">লিঙ্গ<select className="input" name="gender" defaultValue=""><option value="">—</option><option>পুরুষ</option><option>মহিলা</option><option>অন্যান্য</option></select></label>
      </div>
      <SubmitButton className="btn btn-primary btn-block">যোগ করে সিরিয়াল দিন</SubmitButton>
    </form>
  );
}

/** চেনা রোগীকে এক ক্লিকে আজকের সিরিয়াল */
export function QuickSerialButton({ chamberId, patientId }: { chamberId: string; patientId: string }) {
  const [state, action] = useActionState(addWalkIn, undefined);
  return (
    <form action={action} className="stack-sm" style={{ alignItems: "flex-end" }}>
      <input type="hidden" name="chamberId" value={chamberId} />
      <input type="hidden" name="patientId" value={patientId} />
      {state?.ok ? <span className="badge badge-teal">✓ {state.ok}</span> : <SubmitButton className="btn btn-primary" pendingText="…">সিরিয়াল দিন</SubmitButton>}
      {state?.error && <span className="small" style={{ color: "var(--red)" }}>{state.error}</span>}
    </form>
  );
}
