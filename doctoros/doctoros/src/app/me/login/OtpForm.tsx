"use client";
import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { keepValues } from "@/components/keepValues";
import { otpAction } from "../actions";

export function OtpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(otpAction, undefined);
  const step = state?.step ?? "phone";
  return (
    <form onSubmit={keepValues(action)} className="me-card stack">
      <input type="hidden" name="next" value={next} />
      {state?.error && <p className="alert alert-error" role="alert">{state.error}</p>}
      {step === "phone" ? (
        <>
          <label className="field">মোবাইল নাম্বার
            <input className="input me-big" name="phone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="01XXXXXXXXX" defaultValue={state?.phone} required autoFocus />
          </label>
          <SubmitButton pending={pending} className="btn btn-primary btn-big btn-block" name="intent" value="send">কোড পাঠান</SubmitButton>
          <p className="muted small">সিরিয়াল নেওয়ার সময় যে নাম্বার দিয়েছিলেন, সেটাই দিন — আপনার আর পরিবারের সবার সিরিয়াল ও প্রেসক্রিপশন দেখতে পাবেন।</p>
        </>
      ) : (
        <>
          {state?.info && <p className="alert alert-ok" role="status">{state.info}</p>}
          {state?.demoCode && (
            <p className="me-demo" role="status">ডেমো মোড — এসএমএস এখনো চালু হয়নি, তাই কোডটা এখানে দেখানো হচ্ছে: <b>{state.demoCode}</b></p>
          )}
          <label className="field">৬ সংখ্যার কোড
            <input className="input me-big me-code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" required autoFocus />
          </label>
          <SubmitButton pending={pending} className="btn btn-primary btn-big btn-block" name="intent" value="verify">লগইন করুন</SubmitButton>
          <div className="row-sb">
            <SubmitButton pending={pending} className="btn" name="intent" value="resend" formNoValidate pendingText="…">আবার কোড পাঠান</SubmitButton>
            <a href="/me/login" className="small">নাম্বার বদলান</a>
          </div>
        </>
      )}
    </form>
  );
}
