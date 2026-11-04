"use client";
import { useActionState, useEffect, useState } from "react";
import { Icon } from "@/components/Icons";
import { keepValues } from "@/components/keepValues";
import { RELATIONS } from "@/lib/relations";
import { addFamilyMember, selectMember, updateMember } from "../actions";

export type Member = { id: string; name: string; relation: string | null; gender: string | null; age: number | null; code: string; allergies: string | null; conditions: string | null };
const TINTS = [["#D5E6E1", "#0B6E5F"], ["#FFE6D5", "#8A3A10"], ["#E5E3F3", "#3E3577"], ["#E1ECF7", "#1F4E7A"], ["#FDE2E2", "#8E2B2B"]];
const bn = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
const sub = (m: Member) => [m.relation, m.age ? `${bn(m.age)} বছর` : null].filter(Boolean).join(" · ") || "সদস্য";

export function Avatar({ m, i, size = 44 }: { m: Member; i: number; size?: number }) {
  const [bg, fg] = TINTS[i % TINTS.length];
  return <span className="mm-av" style={{ width: size, height: size, flexBasis: size, background: bg, color: fg, fontSize: size * 0.42 }}>{m.name.slice(0, 1)}</span>;
}

/** সদস্যের তথ্য বদলানো / নতুন যোগ — একই ফর্ম */
export function MemberForm({ m, onDone }: { m?: Member; onDone?: () => void }) {
  const [state, act, pending] = useActionState(m ? updateMember : addFamilyMember, undefined);
  useEffect(() => { if (state?.ok) onDone?.(); }, [state, onDone]);
  return (
    <form className="mm-form" onSubmit={keepValues(act)}>
      {m && <input type="hidden" name="id" value={m.id} />}
      <label className="field">নাম<input className="input" name="name" defaultValue={m?.name} required placeholder="যেমন: আমেনা খাতুন" /></label>
      <div className="mm-grid">
        <label className="field">সম্পর্ক<select className="input" name="relation" defaultValue={m?.relation ?? ""}><option value="">—</option>{RELATIONS.map((r) => <option key={r}>{r}</option>)}</select></label>
        <label className="field">বয়স<input className="input" name="age" inputMode="numeric" defaultValue={m?.age ?? ""} placeholder="৪৫" /></label>
        <label className="field">লিঙ্গ<select className="input" name="gender" defaultValue={m?.gender ?? ""}><option value="">—</option><option>পুরুষ</option><option>মহিলা</option><option>অন্যান্য</option></select></label>
      </div>
      {m && (
        <>
          <label className="field">কোনো ওষুধ/খাবারে অ্যালার্জি? (ঐচ্ছিক)<input className="input" name="allergies" defaultValue={m.allergies ?? ""} placeholder="যেমন: পেনিসিলিন, চিংড়ি" /></label>
          <label className="field">দীর্ঘদিনের রোগ (ঐচ্ছিক)<input className="input" name="conditions" defaultValue={m.conditions ?? ""} placeholder="যেমন: ডায়াবেটিস, প্রেসার" /></label>
        </>
      )}
      {state?.error && <p className="alert alert-error" role="alert">⚠ {state.error}</p>}
      {state?.ok && <p className="alert alert-ok" role="status">✓ {state.ok}</p>}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-primary" disabled={pending}>{pending ? "সেভ হচ্ছে…" : m ? "সেভ করুন" : "যোগ করুন"}</button>
        {onDone && <button type="button" className="btn" onClick={onDone}>বাতিল</button>}
      </div>
    </form>
  );
}

/**
 * "কার তথ্য দেখছেন?" — উপরের বোতাম চাপলে সব সদস্যের তালিকা খোলে।
 * এখান থেকেই সদস্য বাছাই, তথ্য বদলানো আর নতুন সদস্য (মা, বাবা…) যোগ।
 */
export function MemberMenu({ members, selectedId }: { members: Member[]; selectedId: string | null }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<string | "new" | null>(null);
  const idx = Math.max(0, members.findIndex((m) => m.id === selectedId));
  const cur = members[idx];
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", esc); };
  }, [open]);

  if (!cur) return null;
  return (
    <>
      <button type="button" className="mm-trigger" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
        <Avatar m={cur} i={idx} size={48} />
        <span className="col grow" style={{ gap: 0, textAlign: "left", minWidth: 0 }}>
          <small>কার তথ্য দেখছেন</small>
          <b>{cur.name}</b>
        </span>
        <span className="mm-switch">{members.length > 1 ? "বদলান" : "সদস্য"}<Icon name="down" size={18} /></span>
      </button>

      <div className={`mm-bg${open ? " open" : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <div className={`mm-sheet${open ? " open" : ""}`} role="dialog" aria-modal="true" aria-label="পরিবারের সদস্য" inert={!open}>
        <div className="mm-sheet-h">
          <b>পরিবারের সদস্য</b>
          <button type="button" className="mm-x" onClick={() => setOpen(false)} aria-label="বন্ধ"><Icon name="x" size={22} /></button>
        </div>
        <p className="mm-hint">কারো নামে চাপলে তার সিরিয়াল, প্রেসক্রিপশন আর স্বাস্থ্য দেখাবে।</p>
        <ul className="mm-list">
          {members.map((m, i) => (
            <li key={m.id} className={m.id === cur.id ? "on" : ""}>
              {edit === m.id ? (
                <MemberForm m={m} onDone={() => setEdit(null)} />
              ) : (
                <div className="mm-row">
                  <form action={selectMember} className="grow" onSubmit={() => setOpen(false)}>
                    <input type="hidden" name="id" value={m.id} />
                    <button className="mm-pick" aria-current={m.id === cur.id ? "true" : undefined}>
                      <Avatar m={m} i={i} />
                      <span className="col" style={{ gap: 0, minWidth: 0 }}><b>{m.name}</b><small>{sub(m)} · {m.code}</small></span>
                      {m.id === cur.id && <span className="mm-on"><Icon name="check" size={16} stroke={3} />দেখছেন</span>}
                    </button>
                  </form>
                  <button type="button" className="mm-edit" onClick={() => setEdit(m.id)} aria-label={`${m.name}-এর তথ্য বদলান`}><Icon name="edit" size={18} />বদলান</button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {edit === "new" ? (
          <div className="mm-new"><b>নতুন সদস্য</b><MemberForm onDone={() => setEdit(null)} /></div>
        ) : (
          <button type="button" className="btn btn-primary btn-block mm-add" onClick={() => setEdit("new")}><Icon name="plus" size={20} />নতুন সদস্য যোগ করুন (মা, বাবা, সন্তান…)</button>
        )}
      </div>
    </>
  );
}
