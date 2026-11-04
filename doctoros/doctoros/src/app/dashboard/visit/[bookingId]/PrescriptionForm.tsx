"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { keepValues } from "@/components/keepValues";
import type { Medicine } from "@/db/schema";
import { autosavePrescription, savePrescription } from "../actions";

const FU_OPTIONS = [["", "প্রয়োজন নেই"], ["7", "৭ দিন"], ["15", "১৫ দিন"], ["30", "১ মাস"], ["90", "৩ মাস"], ["date", "তারিখ বাছুন"]] as const;
const blank: Medicine = { name: "", dose: "", when: "", days: "" };

type Props = {
  bookingId: string;
  initial: { complaint: string; diagnosis: string; advice: string; medicines: Medicine[]; followUpDate: string | null };
  suggestions: string[];
  minDate: string;
  previous?: { medicines: Medicine[]; label: string } | null;
};

export function PrescriptionForm({ bookingId, initial, suggestions, minDate, previous }: Props) {
  const [state, action, pending] = useActionState(savePrescription, undefined);
  const [meds, setMeds] = useState<Medicine[]>(initial.medicines.length ? initial.medicines : [blank]);
  const [fu, setFu] = useState<string>(initial.followUpDate ? "date" : "");
  const update = (i: number, k: keyof Medicine, v: string) => setMeds((m) => m.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  // অটো-সেভ: লেখা থামার ২ সেকেন্ড পর নিজে থেকেই সেভ — শুধু প্রিন্ট করে বা পেজ ছেড়ে গেলেও তথ্য হারায় না
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [auto, setAuto] = useState<{ t: "idle" | "saving" | "saved" | "error"; at?: string }>({ t: "idle" });
  const flush = async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const f = formRef.current;
    if (!f) return;
    setAuto({ t: "saving" });
    const r = await autosavePrescription(new FormData(f)).catch(() => ({ ok: false, at: undefined }));
    setAuto(r.ok ? (r.at ? { t: "saved", at: r.at } : { t: "idle" }) : { t: "error" });
  };
  const schedule = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 2000);
  };
  useEffect(() => { if (meds !== initial.medicines) schedule(); }, [meds]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // ট্যাব বদলালে/বন্ধ করলে বাকি থাকা সেভ এখনই
    const hide = () => { if (document.visibilityState === "hidden" && timer.current) flush(); };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form ref={formRef} onSubmit={keepValues(action)} onInput={schedule} onChange={schedule} className="row" style={{ alignItems: "flex-start", gap: 20 }}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <datalist id="med-suggest">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
      <datalist id="dose-suggest">{["১+০+১", "১+১+১", "০+০+১", "১+০+০", "০+১+০", "প্রয়োজনে"].map((s) => <option key={s} value={s} />)}</datalist>
      <datalist id="when-suggest">{["খাবারের পরে", "খাবারের আগে", "রাতে", "সকালে খালি পেটে"].map((s) => <option key={s} value={s} />)}</datalist>

      <div className="stack" style={{ flex: "3 1 460px", minWidth: 0 }}>
        {state?.error && <p className="alert alert-error" role="alert">{state.error}</p>}
        {state?.ok && <p className="alert alert-ok" role="status">{state.ok}</p>}
        <label className="card field">অভিযোগ<textarea className="input" name="complaint" defaultValue={initial.complaint} rows={2} /></label>
        <label className="card field">রোগ নির্ণয়<input className="input" name="diagnosis" defaultValue={initial.diagnosis} /></label>
        <fieldset className="card stack-sm" style={{ border: "1px solid var(--line)" }}>
          <legend style={{ fontWeight: 700 }}>ওষুধ (Rx)</legend>
          {previous && (
            <button type="button" className="btn rx-copy" onClick={() => {
              // আগেরগুলো বসাই, তবে যে ওষুধ আগেই লেখা আছে তা আবার নয়
              setMeds((cur) => {
                const have = new Set(cur.filter((m) => m.name.trim()).map((m) => m.name.trim().toLowerCase()));
                const add = previous.medicines.filter((m) => !have.has(m.name.trim().toLowerCase()));
                return [...cur.filter((m) => m.name.trim()), ...add].length ? [...cur.filter((m) => m.name.trim()), ...add] : [blank];
              });
            }}>⟲ আগের প্রেসক্রিপশনের ওষুধ কপি করুন ({previous.label})</button>
          )}
          {meds.map((m, i) => (
            <div key={i} className="row" style={{ background: "var(--ground)", padding: 8, borderRadius: 10 }}>
              <input aria-label="ওষুধের নাম" className="input" name="med-name" list="med-suggest" value={m.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="ওষুধের নাম ও মাত্রা" style={{ flex: "2 1 200px" }} />
              <input aria-label="ডোজ" className="input" name="med-dose" list="dose-suggest" value={m.dose} onChange={(e) => update(i, "dose", e.target.value)} placeholder="১+০+১" style={{ flex: "1 1 90px" }} />
              <input aria-label="কখন" className="input" name="med-when" list="when-suggest" value={m.when} onChange={(e) => update(i, "when", e.target.value)} placeholder="খাবারের পরে" style={{ flex: "1 1 120px" }} />
              <input aria-label="কত দিন" className="input" name="med-days" value={m.days} onChange={(e) => update(i, "days", e.target.value)} placeholder="৩০ দিন" style={{ flex: "1 1 80px" }} />
              <button type="button" className="btn" aria-label="ওষুধ বাদ দিন" onClick={() => setMeds((x) => (x.length > 1 ? x.filter((_, j) => j !== i) : [blank]))}>✕</button>
            </div>
          ))}
          <div><button type="button" className="btn" onClick={() => setMeds((x) => [...x, blank])}>+ আরেকটি ওষুধ</button></div>
        </fieldset>
        <label className="card field">পরীক্ষা ও পরামর্শ<textarea className="input" name="advice" defaultValue={initial.advice} rows={3} /></label>
      </div>

      <div className="stack" style={{ flex: "2 1 300px", minWidth: 0 }}>
        <fieldset className="card stack-sm" style={{ border: "1px solid var(--line)" }}>
          <legend style={{ fontWeight: 700 }}>ফলোআপ</legend>
          <div className="grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {FU_OPTIONS.map(([v, label]) => (
              <label key={v} className="chip" style={{ minHeight: 44 }}>
                <input type="radio" name="followUp" value={v} checked={fu === v} onChange={() => setFu(v)} />
                <span className="small">{label}</span>
              </label>
            ))}
          </div>
          {fu === "date" && <label className="field">তারিখ<input className="input" type="date" name="followUpDate" min={minDate} defaultValue={initial.followUpDate ?? ""} required /></label>}
          <p className="alert alert-ok small">{fu ? "ফলোআপের আগের দিন রোগীর কাছে বুকিং লিংকসহ রিমাইন্ডার যাবে।" : "কোনো রিমাইন্ডার যাবে না।"}</p>
        </fieldset>
        <p className={`rx-auto ${auto.t}`} role="status" aria-live="polite">
          {auto.t === "saving" ? "সেভ হচ্ছে…" : auto.t === "saved" ? `✓ নিজে থেকেই সেভ হয়েছে · ${auto.at}` : auto.t === "error" ? "⚠ অটো-সেভ হয়নি — নিচের বোতামে সেভ করুন" : "লিখতে থাকুন — নিজে থেকেই সেভ হবে, রোগীর অ্যাকাউন্টেও যাবে"}
        </p>
        <SubmitButton pending={pending} className="btn btn-primary btn-big btn-block" name="next" value="1">সেভ করে পরের রোগী</SubmitButton>
        <SubmitButton pending={pending} className="btn btn-block">শুধু সেভ করুন</SubmitButton>
        <SubmitButton pending={pending} className="btn btn-block" name="next" value="print">সেভ করে প্রিন্ট (প্যাডে)</SubmitButton>
      </div>
    </form>
  );
}
