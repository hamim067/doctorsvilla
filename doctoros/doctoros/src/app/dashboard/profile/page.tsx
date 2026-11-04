import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { db, schema } from "@/db";
import { requireStaff } from "@/lib/auth";
import { bn, clockDhaka, formatDateBn, today } from "@/lib/time";
import { PasswordForm, ProfileForm } from "./ProfileForms";

export const metadata = { title: "প্রোফাইল ও পাসওয়ার্ড" };

export default async function ProfilePage() {
  const s = await requireStaff();
  const isDoctor = s.role !== "ASSISTANT";
  const [d] = await db.select().from(schema.doctors).where(eq(schema.doctors.id, s.doctorId)).limit(1);
  const h = await headers();
  const origin = process.env.APP_URL || `https://${h.get("host")}`;
  return (
    <>
      <div className="row between">
        <h1>{isDoctor ? "প্রোফাইল ও পাসওয়ার্ড" : "পাসওয়ার্ড"}</h1>
        {isDoctor && <Link className="btn" href={`/dr/${d.slug}`} target="_blank">প্রোফাইল দেখুন ↗</Link>}
      </div>
      {isDoctor && <ProfileForm d={d} origin={origin.replace(/^https?:\/\//, "")} />}
      <section className="card stack-sm" aria-label="সময় অঞ্চল">
        <h2>সময় অঞ্চল</h2>
        <div className="row" style={{ gap: 10 }}>
          <span className="input" style={{ display: "flex", alignItems: "center", maxWidth: 360, background: "var(--ground)" }} aria-readonly="true">Asia/Dhaka — বাংলাদেশ সময় (GMT+6)</span>
          <span className="badge badge-teal">স্থায়ীভাবে সেট</span>
        </div>
        <span className="muted small">সিরিয়াল নম্বর, &quot;আজ&quot;-এর হিসাব, রিপোর্ট, ক্যালেন্ডার আর রিমাইন্ডার — সব ঢাকার সময়ে চলে; নতুন দিন শুরু হয় রাত ১২টায় (ঢাকা)। এখন ঢাকার সময়: {bn(clockDhaka(new Date()))}, {formatDateBn(today())}।</span>
      </section>
      <PasswordForm />
    </>
  );
}
