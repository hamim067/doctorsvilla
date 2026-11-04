import { ResponsiveTables } from "@/components/ResponsiveTables";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";
import { Icon } from "@/components/Icons";
import { patientCode } from "@/lib/booking";
import { familyOf, requirePatient, selectedMember } from "@/lib/patient-auth";
import { thisYear } from "@/lib/time";
import { MemberMenu } from "./MemberMenu";
import { patientLogout } from "../actions";
import "../me.css";
import { MeNav } from "./MeNav";

export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const s = await requirePatient();
  const fam = await familyOf(s.accountId);
  const sel = await selectedMember(fam);
  const y = thisYear();
  const members = fam.map((p) => ({
    id: p.id, name: p.name, relation: p.relation, gender: p.gender, code: patientCode(p.number),
    age: p.birthYear ? y - p.birthYear : null, allergies: p.allergies, conditions: p.conditions,
  }));
  return (
    <div className="me">
      <header className="me-head">
        <div className="me-wrap row-sb">
          <Link href="/" className="me-logo dark"><span className="me-mark"><Icon name="plus" size={16} stroke={2.8} color="#5BD6A4" /></span>DoctorOS</Link>
          <form action={patientLogout} className="me-head-r">
            <ThemeToggle className="home-mode" label={false} />
            <span className="small muted me-phone">{s.phone}</span>
            <button className="btn me-out">লগআউট</button>
          </form>
        </div>
      </header>
      <div className="me-wrap me-tabs-wrap"><MeNav variant="top" /></div>
      {members.length > 0 && <div className="me-wrap me-member-bar"><MemberMenu members={members} selectedId={sel?.id ?? null} /></div>}
      <main className="me-wrap me-main">{children}</main>
      <MeNav />
      <ResponsiveTables />
    </div>
  );
}
