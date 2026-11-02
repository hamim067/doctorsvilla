import Link from "next/link";
import { Icon } from "@/components/Icons";

const POINTS = ["অনলাইন সিরিয়াল ও লাইভ কিউ", "অটোমেটিক ফলোআপ রিমাইন্ডার", "নিজস্ব প্রোফাইল পেজ", "অ্যাসিস্ট্যান্টের আলাদা লগইন"];

/** লগইন ও রেজিস্ট্রেশনের দুই ভাগের লেআউট — বামে ব্র্যান্ড, ডানে ফর্ম */
export function AuthShell({ title, sub, children, footer }: { title: string; sub?: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <main className="auth">
      <aside className="auth-side">
        <Link href="/" className="auth-logo"><span className="auth-mark"><Icon name="pulse" size={22} stroke={2.4} color="#fff" /></span>DoctorOS</Link>
        <div className="auth-pitch">
          <h2>আপনার চেম্বার, আপনার ব্র্যান্ড — এক জায়গায়</h2>
          <ul>
            {POINTS.map((p) => (
              <li key={p}><span><Icon name="check" size={14} stroke={3} /></span>{p}</li>
            ))}
          </ul>
        </div>
        <div className="auth-now" aria-hidden="true">
          <span>এখন চলছে</span><b>১২</b><small>পরের সিরিয়াল ১৩ · প্রস্তুত থাকুন</small>
        </div>
      </aside>
      <section className="auth-main">
        <div className="auth-box">
          <Link href="/" className="auth-logo auth-logo-m"><span className="auth-mark"><Icon name="pulse" size={20} stroke={2.4} color="#fff" /></span>DoctorOS</Link>
          <h1>{title}</h1>
          {sub && <p className="muted">{sub}</p>}
          {children}
          <p className="muted">{footer}</p>
        </div>
      </section>
    </main>
  );
}
