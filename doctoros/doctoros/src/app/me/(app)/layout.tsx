import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";
import { Icon } from "@/components/Icons";
import { requirePatient } from "@/lib/patient-auth";
import { patientLogout } from "../actions";
import "../me.css";
import { MeNav } from "./MeNav";

export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const s = await requirePatient();
  return (
    <div className="me">
      <header className="me-head">
        <div className="me-wrap row-sb">
          <Link href="/" className="me-logo dark"><span className="me-mark"><Icon name="plus" size={16} stroke={2.8} color="#5BD6A4" /></span>DoctorOS</Link>
          <form action={patientLogout} className="row" style={{ gap: 10 }}>
            <ThemeToggle className="home-mode" label={false} />
            <span className="small muted">{s.phone}</span>
            <button className="btn" style={{ minHeight: 38 }}>লগআউট</button>
          </form>
        </div>
      </header>
      <main className="me-wrap me-main">{children}</main>
      <MeNav />
    </div>
  );
}
