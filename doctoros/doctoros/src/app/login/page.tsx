import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "লগইন" };

export default async function LoginPage() {
  if (await getSession()) redirect("/dashboard");
  return (
    <main className="narrow stack" style={{ paddingTop: 64 }}>
      <Link href="/" style={{ fontSize: 22, fontWeight: 700 }}>DoctorOS</Link>
      <h1>ডাক্তার ও অ্যাসিস্ট্যান্ট লগইন</h1>
      <LoginForm />
      <p className="muted">নতুন ডাক্তার? <Link href="/register">অ্যাকাউন্ট খুলুন</Link></p>
    </main>
  );
}
