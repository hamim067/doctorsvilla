"use client";
import { useActionState } from "react";
import { login } from "@/app/auth-actions";
import { SubmitButton } from "@/components/SubmitButton";
import { keepValues } from "@/components/keepValues";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form onSubmit={keepValues(action)} className="card stack">
      {state?.error && <p className="alert alert-error" role="alert">{state.error}</p>}
      <label className="field">মোবাইল নাম্বার
        <input className="input" name="phone" type="tel" inputMode="numeric" autoComplete="username" placeholder="01XXXXXXXXX" required />
      </label>
      <label className="field">পাসওয়ার্ড
        <input className="input" name="password" type="password" autoComplete="current-password" required />
      </label>
      <SubmitButton pending={pending} className="btn btn-primary btn-block">লগইন</SubmitButton>
    </form>
  );
}
