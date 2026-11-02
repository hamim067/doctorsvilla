"use client";
import { useState } from "react";
import { Icon } from "@/components/Icons";

const TABS = [
  { label: "ডাক্তার", ph: "ডাক্তারের নাম" },
  { label: "বিভাগ", ph: "যেমন: হৃদরোগ, দাঁত" },
  { label: "চেম্বার", ph: "চেম্বারের নাম" },
];

/** মোবাইলের সার্চ বক্স — ট্যাব শুধু ইঙ্গিত দেয়, খোঁজা হয় সব জায়গায় */
export function HomeMobileSearch({ q, city, cities }: { q: string; city: string; cities: string[] }) {
  const [tab, setTab] = useState(0);
  return (
    <form action="/" className="hm-search" role="search">
      <div className="hm-tabs" role="tablist" aria-label="কী দিয়ে খুঁজবেন">
        {TABS.map((t, i) => (
          <button key={t.label} type="button" role="tab" aria-selected={tab === i} className={tab === i ? "on" : ""} onClick={() => setTab(i)}>
            {t.label}
          </button>
        ))}
      </div>
      <label className="hm-field">
        <Icon name="search" size={20} color="#55635F" />
        <span className="sr">খুঁজুন</span>
        <input name="q" defaultValue={q} placeholder={TABS[tab].ph} />
      </label>
      {cities.length > 1 && (
        <label className="hm-field">
          <Icon name="pin" size={18} color="#55635F" />
          <span className="sr">শহর</span>
          <select name="city" defaultValue={city}>
            <option value="">সব শহর</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      )}
      <button className="hm-go">{city ? `${city}-এ খুঁজুন` : "খুঁজুন"}</button>
    </form>
  );
}
