"use client";
import { useActionState } from "react";
import { keepValues } from "@/components/keepValues";
import { SubmitButton } from "@/components/SubmitButton";
import { resetAssistantPassword } from "./actions";

export function ResetPassword({ id }: { id: string }) {
  const [state, action, pending] = useActionState(resetAssistantPassword, undefined);
  if (state?.ok) return <span className="badge badge-teal">✓ {state.ok}</span>;
  return (
    <form onSubmit={keepValues(action)} className="row" style={{ gap: 6 }}>
      <input type="hidden" name="id" value={id} />
      <label className="sr" htmlFor={`pw-${id}`}>নতুন পাসওয়ার্ড</label>
      <input id={`pw-${id}`} className="input" name="password" placeholder="নতুন পাসওয়ার্ড" minLength={6} required style={{ minHeight: 36, width: 150 }} />
      <SubmitButton pending={pending} className="btn" style={{ minHeight: 36 }} pendingText="…">সেট করুন</SubmitButton>
      {state?.error && <span className="small" style={{ color: "var(--red)" }}>{state.error}</span>}
    </form>
  );
}
