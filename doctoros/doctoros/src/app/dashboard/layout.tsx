import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { logout } from "@/app/auth-actions";
import { NavLink } from "@/components/NavLink";
import { requireStaff } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const s = await requireStaff();
  const [doctor] = await db.select({ name: schema.doctors.name, slug: schema.doctors.slug }).from(schema.doctors).where(eq(schema.doctors.id, s.doctorId)).limit(1);
  const isDoctor = s.role !== "ASSISTANT";
  return (
    <div className="dash">
      <aside className="dash-side">
        <span className="brand">DoctorOS</span>
        <NavLink href="/dashboard">ড্যাশবোর্ড</NavLink>
        <NavLink href="/dashboard/queue">সিরিয়াল কিউ</NavLink>
        <NavLink href="/dashboard/patients">রোগী খোঁজা</NavLink>
        <NavLink href="/dashboard/followups">ফলোআপ</NavLink>
        {isDoctor && <NavLink href="/dashboard/chambers">চেম্বার সেটিং</NavLink>}
        {isDoctor && <NavLink href="/dashboard/staff">অ্যাসিস্ট্যান্ট</NavLink>}
        {doctor && <a className="nav" href={`/dr/${doctor.slug}`} target="_blank" rel="noreferrer">আমার পাবলিক প্রোফাইল ↗</a>}
        <div className="who stack-sm">
          <span style={{ fontWeight: 600 }}>{doctor?.name}</span>
          <span style={{ color: "#b9d3cd" }}>লগইন: {s.name} ({isDoctor ? "ডাক্তার" : "অ্যাসিস্ট্যান্ট"})</span>
          <form action={logout}><button className="btn" style={{ minHeight: 36, background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.3)" }}>লগআউট</button></form>
        </div>
      </aside>
      <main className="dash-main">{children}</main>
    </div>
  );
}
