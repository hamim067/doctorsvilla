import { patientCode } from "@/lib/booking";
import { familyOf, requirePatient } from "@/lib/patient-auth";
import { bn, thisYear } from "@/lib/time";
import { updateRelation } from "../../actions";
import { RELATIONS } from "@/lib/relations";
import { AddMember } from "./AddMember";

export const metadata = { title: "পরিবার" };
export const dynamic = "force-dynamic";

const TINTS = [["#D5E6E1", "#0B6E5F"], ["#FFE6D5", "#8A3A10"], ["#E5E3F3", "#3E3577"], ["#E1ECF7", "#1F4E7A"]];

export default async function Family() {
  const s = await requirePatient();
  const fam = await familyOf(s.accountId);
  const year = thisYear();
  return (
    <div className="stack">
      <div className="col" style={{ gap: 4 }}>
        <h1>পরিবার</h1>
        <span className="muted">এক নাম্বারে ({s.phone}) সবার সিরিয়াল আর ফাইল আলাদা থাকবে।</span>
      </div>
      {fam.map((p, i) => (
        <div key={p.id} className="me-card me-member">
          <span className="me-av" style={{ background: TINTS[i % 4][0], color: TINTS[i % 4][1] }}>{p.name.slice(0, 1)}</span>
          <div className="col grow" style={{ gap: 0 }}>
            <b style={{ fontSize: 16 }}>{p.name}</b>
            <span className="small muted">{[p.gender, p.birthYear ? `${bn(year - p.birthYear)} বছর` : null].filter(Boolean).join(" · ") || "—"}</span>
            <span className="xs muted">আইডি {patientCode(p.number)}</span>
          </div>
          <form action={updateRelation} className="row" style={{ gap: 6 }}>
            <input type="hidden" name="id" value={p.id} />
            <label className="sr" htmlFor={`rel-${p.id}`}>সম্পর্ক</label>
            <select id={`rel-${p.id}`} name="relation" defaultValue={p.relation ?? ""} className="input" style={{ minHeight: 38, width: 96, padding: "4px 8px" }}>
              <option value="">—</option>{RELATIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
            <button className="btn" style={{ minHeight: 38, padding: "0 10px" }}>সেভ</button>
          </form>
        </div>
      ))}
      <AddMember first={fam.length === 0} />
      <p className="small muted">প্রতিটি সদস্যের নিজস্ব রোগী আইডি থাকে। চেম্বারে নাম্বার বললেই অ্যাসিস্ট্যান্ট সবার তালিকা দেখতে পাবেন।</p>
    </div>
  );
}
