"use client";
import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { RELATIONS } from "@/lib/relations";
import { addFamilyMember } from "../../actions";


export function AddMember({ first }: { first: boolean }) {
  const [state, action] = useActionState(addFamilyMember, undefined);
  return (
    <form action={action} className="me-card stack">
      <h2>{first ? "নিজের প্রোফাইল তৈরি করুন" : "নতুন সদস্য যোগ করুন"}</h2>
      {state?.error && <p className="alert alert-error" role="alert">{state.error}</p>}
      {state?.ok && <p className="alert alert-ok" role="status">✓ {state.ok}</p>}
      <label className="field">নাম<input className="input" name="name" required /></label>
      <div className="grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        <label className="field">সম্পর্ক<select className="input" name="relation" defaultValue={first ? "নিজে" : ""}><option value="">—</option>{RELATIONS.map((r) => <option key={r}>{r}</option>)}</select></label>
        <label className="field">বয়স<input className="input" name="age" type="text" inputMode="numeric" /></label>
        <label className="field">লিঙ্গ<select className="input" name="gender" defaultValue=""><option value="">—</option><option>পুরুষ</option><option>মহিলা</option><option>অন্যান্য</option></select></label>
      </div>
      <SubmitButton className="btn btn-primary btn-block">যোগ করুন</SubmitButton>
    </form>
  );
}
