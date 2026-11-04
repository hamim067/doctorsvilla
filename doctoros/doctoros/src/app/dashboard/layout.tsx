import { eq } from "drizzle-orm";
import "@fontsource/anek-bangla/400.css";
import "@fontsource/anek-bangla/500.css";
import "@fontsource/anek-bangla/600.css";
import "@fontsource/anek-bangla/700.css";
import "@fontsource/anek-bangla/800.css";
import { cookies } from "next/headers";
import { db, schema } from "@/db";
import { logout } from "@/app/auth-actions";
import { ResponsiveTables } from "@/components/ResponsiveTables";
import { requireStaff } from "@/lib/auth";
import { DashShell, type NavGroup, type NavItem } from "./DashShell";
import "./shell.css";

type Item = NavItem & { doctorOnly?: boolean };
const GROUPS: { bn: string; en: string; items: Item[] }[] = [
  { bn: "প্রতিদিনের কাজ", en: "Daily work", items: [
    { href: "/dashboard", bn: "ড্যাশবোর্ড", en: "Dashboard", icon: "pulse" },
    { href: "/dashboard/queue", bn: "সিরিয়াল কিউ", en: "Serial queue", icon: "bell" },
    { href: "/dashboard/patients", bn: "রোগী খোঁজা", en: "Patients", icon: "search" },
    { href: "/dashboard/followups", bn: "ফলোআপ", en: "Follow-ups", icon: "check" },
  ] },
  { bn: "বৃদ্ধি", en: "Growth", items: [
    { href: "/dashboard/reports", bn: "রিপোর্ট", en: "Reports", icon: "steth", doctorOnly: true },
    { href: "/dashboard/website", bn: "আমার ওয়েবসাইট", en: "My website", icon: "globe", doctorOnly: true },
    { href: "/dashboard/share", bn: "শেয়ার ও QR", en: "Share & QR", icon: "layout", doctorOnly: true },
  ] },
  { bn: "সেটিং", en: "Settings", items: [
    { href: "/dashboard/chambers", bn: "চেম্বার সেটিং", en: "Chambers", icon: "pin", doctorOnly: true },
    { href: "/dashboard/staff", bn: "অ্যাসিস্ট্যান্ট", en: "Assistants", icon: "family", doctorOnly: true },
    { href: "/dashboard/profile", bn: "প্রোফাইল", en: "Profile", icon: "shield" },
  ] },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const s = await requireStaff();
  const [doctor] = await db.select({ name: schema.doctors.name, slug: schema.doctors.slug }).from(schema.doctors).where(eq(schema.doctors.id, s.doctorId)).limit(1);
  const isDoctor = s.role !== "ASSISTANT";
  const jar = await cookies();
  const lang = jar.get("dos_lang")?.value === "en" ? "en" : "bn";
  const mini = jar.get("dos_side")?.value === "mini";
  const groups: NavGroup[] = GROUPS.map((g) => ({
    bn: g.bn, en: g.en,
    items: g.items.filter((i) => isDoctor || !i.doctorOnly).map(({ doctorOnly: _, ...i }) => (i.href === "/dashboard/profile" && !isDoctor ? { ...i, bn: "পাসওয়ার্ড", en: "Password" } : i)),
  })).filter((g) => g.items.length > 0);
  return (
    <DashShell groups={groups} lang={lang} mini={mini} doctorName={doctor?.name ?? ""} userName={s.name} isDoctor={isDoctor} slug={doctor?.slug ?? null} logout={logout}>
      {children}
      <ResponsiveTables />
    </DashShell>
  );
}
