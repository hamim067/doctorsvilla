"use client";
import { useActionState } from "react";
import { keepValues } from "@/components/keepValues";
import { SubmitButton } from "@/components/SubmitButton";
import { changePassword, saveProfile } from "./actions";

type Doc = { name: string; degrees: string; specialty: string; bmdcNo: string; slug: string; bio: string | null; experienceYears: number | null; bmdcVerified: boolean };

export function ProfileForm({ d, origin }: { d: Doc; origin: string }) {
  const [state, action, pending] = useActionState(saveProfile, undefined);
  return (
    <form onSubmit={keepValues(action)} className="card stack">
      <h2>প্রোফাইলের তথ্য</h2>
      <div className="grid">
        <label className="field">নাম<input className="input" name="name" defaultValue={d.name} required /></label>
        <label className="field">ডিগ্রি<input className="input" name="degrees" defaultValue={d.degrees} required /></label>
      </div>
      <div className="grid">
        <label className="field">বিশেষজ্ঞতা<input className="input" name="specialty" defaultValue={d.specialty} placeholder="যেমন: হৃদরোগ বিশেষজ্ঞ" required />
          <span className="muted small" style={{ fontWeight: 400 }}>হোম পেজের বিভাগে এই লেখা দিয়েই খোঁজা হয়</span></label>
        <label className="field">অভিজ্ঞতা (বছর)<input className="input" name="experienceYears" inputMode="numeric" defaultValue={d.experienceYears ?? ""} /></label>
      </div>
      <div className="grid">
        <label className="field">BMDC নাম্বার<input className="input" name="bmdcNo" defaultValue={d.bmdcNo} required />
          <span className="muted small" style={{ fontWeight: 400 }}>{d.bmdcVerified ? "✓ যাচাইকৃত — বদলালে আবার যাচাই করতে হবে" : "যাচাই এখনো বাকি"}</span></label>
        <label className="field">প্রোফাইল লিংক<input className="input" name="slug" defaultValue={d.slug} required />
          <span className="muted small" style={{ fontWeight: 400 }}>{origin}/dr/{d.slug} — বদলালে পুরনো লিংক ও QR আর কাজ করবে না</span></label>
      </div>
      <label className="field">পরিচিতি (রোগীরা প্রোফাইলে দেখবেন)
        <textarea className="input" name="bio" rows={5} defaultValue={d.bio ?? ""} placeholder="কোন কোন রোগের চিকিৎসা করেন, কোথায় কাজ করেন, অভিজ্ঞতা…" />
      </label>
      {state?.error && <p className="alert alert-error" role="alert">⚠ {state.error}</p>}
      {state?.ok && <p className="alert alert-ok" role="status">✓ {state.ok}</p>}
      <div><SubmitButton pending={pending}>সেভ করুন</SubmitButton></div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form onSubmit={keepValues(action)} className="card stack" key={state?.ok ? "done" : "form"}>
      <h2>পাসওয়ার্ড বদলান</h2>
      <div className="grid">
        <label className="field">বর্তমান পাসওয়ার্ড<input className="input" name="current" type="password" autoComplete="current-password" required /></label>
        <label className="field">নতুন পাসওয়ার্ড<input className="input" name="next" type="password" autoComplete="new-password" minLength={8} required /></label>
        <label className="field">আবার নতুন পাসওয়ার্ড<input className="input" name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>
      </div>
      {state?.error && <p className="alert alert-error" role="alert">⚠ {state.error}</p>}
      {state?.ok && <p className="alert alert-ok" role="status">✓ {state.ok}</p>}
      <div><SubmitButton pending={pending} className="btn">পাসওয়ার্ড বদলান</SubmitButton></div>
    </form>
  );
}
