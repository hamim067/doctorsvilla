"use client";
import { useActionState } from "react";
import { registerDoctor } from "@/app/auth-actions";
import { SubmitButton } from "@/components/SubmitButton";
import { keepValues } from "@/components/keepValues";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerDoctor, undefined);
  return (
    <form onSubmit={keepValues(action)} className="card stack">
      {state?.error && <p className="alert alert-error" role="alert">{state.error}</p>}
      <label className="field">ডাক্তারের নাম
        <input className="input" name="name" placeholder="ডা. তানভীর আহমেদ" required />
      </label>
      <div className="grid">
        <label className="field">ডিগ্রি
          <input className="input" name="degrees" placeholder="MBBS, FCPS (মেডিসিন)" required />
        </label>
        <label className="field">বিশেষজ্ঞতা
          <input className="input" name="specialty" placeholder="হৃদরোগ বিশেষজ্ঞ" required />
        </label>
      </div>
      <div className="grid">
        <label className="field">BMDC রেজিস্ট্রেশন নাম্বার
          <input className="input" name="bmdcNo" placeholder="A-12345" required />
        </label>
        <label className="field">প্রোফাইল লিংক
          <input className="input" name="slug" placeholder="dr-tanvir" pattern="[a-z0-9][a-z0-9\-]{2,40}" required />
          <span className="muted small" style={{ fontWeight: 400 }}>রোগীরা দেখবেন: /dr/dr-tanvir</span>
        </label>
      </div>
      <div className="grid">
        <label className="field">মোবাইল নাম্বার (লগইনের জন্য)
          <input className="input" name="phone" type="tel" inputMode="numeric" autoComplete="username" placeholder="01XXXXXXXXX" required />
        </label>
        <label className="field">পাসওয়ার্ড
          <input className="input" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </label>
      </div>
      <SubmitButton pending={pending} className="btn btn-primary btn-block">অ্যাকাউন্ট খুলুন</SubmitButton>
      <p className="muted small">BMDC নাম্বার যাচাই হলে প্রোফাইলে &quot;যাচাইকৃত&quot; ব্যাজ দেখাবে।</p>
    </form>
  );
}
