"use client";
import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { addHoliday } from "../actions";

export function HolidayForm({ chamberId, min }: { chamberId: string; min: string }) {
  const [state, action] = useActionState(addHoliday, undefined);
  return (
    <form action={action} className="stack-sm">
      <input type="hidden" name="chamberId" value={chamberId} />
      {state?.error && <p className="alert alert-error" role="alert">{state.error}</p>}
      {state?.ok && <p className="alert alert-ok" role="status">{state.ok}</p>}
      <div className="row">
        <label className="field">তারিখ<input className="input" type="date" name="date" min={min} required /></label>
        <label className="field" style={{ flex: 1 }}>কারণ (ঐচ্ছিক)<input className="input" name="note" placeholder="বিজয় দিবস" /></label>
      </div>
      <div><SubmitButton className="btn btn-warn">ছুটি যোগ করুন ও রোগীদের জানান</SubmitButton></div>
    </form>
  );
}
