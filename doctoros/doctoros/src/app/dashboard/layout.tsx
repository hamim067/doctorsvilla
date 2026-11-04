import { eq } from "drizzle-orm";
import "@fontsource/anek-bangla/400.css";
import "@fontsource/anek-bangla/500.css";
import "@fontsource/anek-bangla/600.css";
import "@fontsource/anek-bangla/700.css";
import "@fontsource/anek-bangla/800.css";
import Link from "next/link";
import { db, schema } from "@/db";
import { logout } from "@/app/auth-actions";
import { Icon, type ICON } from "@/components/Icons";
import { NavLink } from "@/components/NavLink";
import { ResponsiveTables } from "@/components/ResponsiveTables";
import { ThemeToggle } from "@/components/ThemeToggle";
import { requireStaff } from "@/lib/auth";

type Item = { href: string; label: string; icon: keyof typeof ICON; doctorOnly?: boolean };
const DAILY: Item[] = [
  { href: "/dashboard", label: "ড্যাশবোর্ড", icon: "pulse" },
  { href: "/dashboard/queue", label: "সিরিয়াল কিউ", icon: "bell" },
  { href: "/dashboard/patients", label: "রোগী খোঁজা", icon: "search" },
  { href: "/dashboard/followups", label: "ফলোআপ", icon: "check" },
];
const GROW: Item[] = [
  { href: "/dashboard/reports", label: "রিপোর্ট", icon: "steth", doctorOnly: true },
  { href: "/dashboard/website", label: "আমার ওয়েবসাইট", icon: "globe", doctorOnly: true },
  { href: "/dashboard/share", label: "শেয়ার ও QR", icon: "arrow", doctorOnly: true },
];
const SETTINGS: Item[] = [
  { href: "/dashboard/chambers", label: "চেম্বার সেটিং", icon: "pin", doctorOnly: true },
  { href: "/dashboard/staff", label: "অ্যাসিস্ট্যান্ট", icon: "family", doctorOnly: true },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const s = await requireStaff();
  const [doctor] = await db.select({ name: schema.doctors.name, slug: schema.doctors.slug }).from(schema.doctors).where(eq(schema.doctors.id, s.doctorId)).limit(1);
  const isDoctor = s.role !== "ASSISTANT";
  const show = (list: Item[]) => list.filter((i) => isDoctor || !i.doctorOnly);
  const link = (i: Item) => <NavLink key={i.href} href={i.href}><Icon name={i.icon} size={18} />{i.label}</NavLink>;
  return (
    <div className="dash">
      <aside className="dash-side">
        <div className="dash-top">
          <Link href="/dashboard" className="brand-sm"><span className="brand-mark"><Icon name="pulse" size={18} stroke={2.4} color="#fff" /></span>DoctorOS</Link>
          <span className="who-name">{s.name}</span>
          <span className="dash-top-r">
            <ThemeToggle />
            <form action={logout}><button className="who-out">লগআউট</button></form>
          </span>
        </div>
        <Link href="/dashboard" className="brand"><span className="brand-mark"><Icon name="pulse" size={20} stroke={2.4} color="#fff" /></span>DoctorOS</Link>
        <nav className="dash-nav" aria-label="ড্যাশবোর্ড মেনু">
          <span className="dash-nav-label">প্রতিদিনের কাজ</span>
          {show(DAILY).map(link)}
          {isDoctor && <span className="dash-nav-label">বৃদ্ধি</span>}
          {show(GROW).map(link)}
          <span className="dash-nav-label">সেটিং</span>
          {show(SETTINGS).map(link)}
          <NavLink href="/dashboard/profile"><Icon name="shield" size={18} />{isDoctor ? "প্রোফাইল" : "পাসওয়ার্ড"}</NavLink>
          {doctor && <a className="nav" href={`/dr/${doctor.slug}`} target="_blank" rel="noreferrer"><Icon name="chevron" size={18} />পাবলিক প্রোফাইল ↗</a>}
        </nav>
        <div className="who">
          <span style={{ fontWeight: 600 }}>{doctor?.name}</span>
          <span style={{ color: "var(--side-ink)", fontSize: 13 }}>লগইন: {s.name} · {isDoctor ? "ডাক্তার" : "অ্যাসিস্ট্যান্ট"}</span>
          <span className="row" style={{ gap: 8 }}>
            <ThemeToggle />
            <form action={logout}><button className="who-out">লগআউট</button></form>
          </span>
        </div>
      </aside>
      <main className="dash-main">{children}</main>
      <ResponsiveTables />
    </div>
  );
}
