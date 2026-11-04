"use client";
import { useState } from "react";
import { Icon } from "@/components/Icons";
import { selectMember } from "../../actions";
import { Avatar, type Member, MemberForm } from "../MemberMenu";

const bn = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);

export function FamilyList({ members, selectedId }: { members: Member[]; selectedId: string | null }) {
  const [edit, setEdit] = useState<string | "new" | null>(members.length ? null : "new");
  return (
    <div className="fl">
      {members.map((m, i) => (
        <article key={m.id} className={`fl-card${m.id === selectedId ? " on" : ""}`}>
          {edit === m.id ? <MemberForm m={m} onDone={() => setEdit(null)} /> : (
            <>
              <div className="fl-top">
                <Avatar m={m} i={i} size={60} />
                <div className="col grow" style={{ gap: 2, minWidth: 0 }}>
                  <b className="fl-name">{m.name}</b>
                  <span className="fl-sub">{[m.relation, m.gender, m.age ? `${bn(m.age)} বছর` : null].filter(Boolean).join(" · ") || "তথ্য যোগ করুন"}</span>
                  <span className="fl-code">রোগী আইডি {m.code}</span>
                </div>
              </div>
              {(m.allergies || m.conditions) && (
                <div className="fl-tags">
                  {m.allergies && <span className="fl-tag red"><Icon name="alert" size={14} />অ্যালার্জি: {m.allergies}</span>}
                  {m.conditions && <span className="fl-tag">{m.conditions}</span>}
                </div>
              )}
              <div className="fl-act">
                {m.id === selectedId ? <span className="fl-now"><Icon name="check" size={16} stroke={3} />এখন এঁর তথ্য দেখছেন</span> : (
                  <form action={selectMember}><input type="hidden" name="id" value={m.id} /><button className="btn btn-primary"><Icon name="eye" size={18} />এঁর তথ্য দেখুন</button></form>
                )}
                <button type="button" className="btn" onClick={() => setEdit(m.id)}><Icon name="edit" size={18} />তথ্য বদলান</button>
              </div>
            </>
          )}
        </article>
      ))}
      {edit === "new" ? (
        <article className="fl-card new"><b className="fl-name">{members.length ? "নতুন সদস্য" : "নিজের তথ্য দিন"}</b><MemberForm onDone={members.length ? () => setEdit(null) : undefined} /></article>
      ) : (
        <button type="button" className="fl-add" onClick={() => setEdit("new")}><Icon name="plus" size={24} />নতুন সদস্য যোগ করুন<small>মা, বাবা, স্বামী/স্ত্রী, সন্তান…</small></button>
      )}
    </div>
  );
}
