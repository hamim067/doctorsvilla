import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/Icons";
import { getPatientSession } from "@/lib/patient-auth";
import "../me.css";
import { OtpForm } from "./OtpForm";

export const metadata = { title: "রোগী লগইন" };

export default async function PatientLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/me" } = await searchParams;
  if (await getPatientSession()) redirect(next.startsWith("/") ? next : "/me");
  return (
    <main className="me-login">
      <div className="me-login-top">
        <Link href="/" className="me-logo"><span className="me-mark"><Icon name="plus" size={16} stroke={2.8} color="#5BD6A4" /></span>DoctorOS</Link>
        <h1>আমার সিরিয়াল ও ফাইল</h1>
        <p>মোবাইল নাম্বারে একটা কোড যাবে — পাসওয়ার্ড লাগবে না।</p>
      </div>
      <div className="me-wrap" style={{ marginTop: -48 }}>
        <OtpForm next={next} />
        <p className="small muted" style={{ marginTop: 16 }}>ডাক্তার বা অ্যাসিস্ট্যান্ট? <Link href="/login">এখানে লগইন করুন</Link></p>
      </div>
    </main>
  );
}
