import { patientCode } from "@/lib/booking";
import { familyOf, requirePatient, selectedMember } from "@/lib/patient-auth";
import { thisYear } from "@/lib/time";
import { FamilyList } from "./FamilyList";

export const metadata = { title: "পরিবার" };
export const dynamic = "force-dynamic";

/** পরিবারের সদস্য — দেখা, বদলানো, নতুন যোগ (একই নামে দুবার নয়) */
export default async function Family() {
  const s = await requirePatient();
  const fam = await familyOf(s.accountId);
  const sel = await selectedMember(fam);
  const y = thisYear();
  const members = fam.map((p) => ({
    id: p.id, name: p.name, relation: p.relation, gender: p.gender, code: patientCode(p.number),
    age: p.birthYear ? y - p.birthYear : null, allergies: p.allergies, conditions: p.conditions,
  }));
  return (
    <div className="md">
      <div className="col" style={{ gap: 4 }}>
        <h1>পরিবারের সদস্য</h1>
        <span className="muted">এক নম্বরে ({s.phone}) সবার সিরিয়াল আর প্রেসক্রিপশন আলাদা আলাদা থাকে। ডাক্তারের কাছে এই নম্বর বললেই হবে।</span>
      </div>
      <FamilyList members={members} selectedId={sel?.id ?? null} />
    </div>
  );
}
