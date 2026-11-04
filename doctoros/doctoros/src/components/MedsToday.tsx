import { Icon } from "@/components/Icons";
import type { CurrentMed, Slot } from "@/lib/meds";

const bn = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
const SLOTS: { k: Slot; label: string; icon: "sun" | "moon"; cls: string }[] = [
  { k: "morning", label: "সকাল", icon: "sun", cls: "s1" },
  { k: "noon", label: "দুপুর", icon: "sun", cls: "s2" },
  { k: "night", label: "রাত", icon: "moon", cls: "s3" },
];
const qty = (n: number) => (n === 0.5 ? "আধা" : bn(n)) + "টা";
const left = (m: CurrentMed) =>
  m.daysLeft === Infinity ? "নিয়মিত চলবে" : m.daysLeft ? `আর ${bn(m.daysLeft)} দিন` : "দিন লেখা নেই";

/** চলমান ওষুধ — সকাল / দুপুর / রাত ভাগ করে, ছোট ছেলেও যেন বোঝে */
export function MedsToday({ meds, empty = "এখন কোনো চলমান ওষুধ নেই।" }: { meds: CurrentMed[]; empty?: string }) {
  if (!meds.length) return <p className="mt-empty">{empty}</p>;
  const other = meds.filter((m) => !m.slots || (m.slots.morning + m.slots.noon + m.slots.night === 0));
  return (
    <div className="mt">
      {SLOTS.map((s) => {
        const list = meds.filter((m) => m.slots && m.slots[s.k] > 0);
        if (!list.length) return null;
        return (
          <div key={s.k} className={`mt-slot ${s.cls}`}>
            <span className="mt-when"><Icon name={s.icon} size={20} />{s.label}</span>
            <ul>
              {list.map((m) => (
                <li key={m.name}>
                  <b>{m.name}</b>
                  <span>{qty(m.slots![s.k])}{m.when ? ` · ${m.when}` : ""}</span>
                  <em className={m.daysLeft !== null && m.daysLeft !== Infinity && m.daysLeft <= 3 ? "soon" : ""}>{left(m)}</em>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {other.length > 0 && (
        <div className="mt-slot s4">
          <span className="mt-when"><Icon name="pill" size={20} />অন্যভাবে খাবেন</span>
          <ul>{other.map((m) => <li key={m.name}><b>{m.name}</b><span>{[m.dose, m.when].filter(Boolean).join(" · ") || "ডাক্তারের লেখা দেখুন"}</span><em>{left(m)}</em></li>)}</ul>
        </div>
      )}
    </div>
  );
}
