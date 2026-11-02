"use client";
import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { addAssistant } from "./actions";

export function AssistantForm() {
  const [state, action] = useActionState(addAssistant, undefined);
  return (
    <form action={action} className="card stack">
      <h2>নতুন অ্যাসিস্ট্যান্ট</h2>
      {state?.error && <p className="alert alert-error" role="alert">{state.error}</p>}
      {state?.ok && <p className="alert alert-ok" role="status">{state.ok}</p>}
      <div className="grid">
        <label className="field">নাম<input className="input" name="name" required /></label>
        <label className="field">মোবাইল নাম্বার<input className="input" name="phone" type="tel" inputMode="numeric" required /></label>
        <label className="field">পাসওয়ার্ড<input className="input" name="password" type="text" minLength={6} required /></label>
      </div>
      <div><SubmitButton>যোগ করুন</SubmitButton></div>
    </form>
  );
}
