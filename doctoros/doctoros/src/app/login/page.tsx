import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "লগইন" };

export default async function LoginPage() {
  if (await getSession()) redirect("/dashboard");
  return (
    <AuthShell title="ডাক্তার ও অ্যাসিস্ট্যান্ট লগইন" sub="মোবাইল নাম্বার আর পাসওয়ার্ড দিয়ে ঢুকুন।" footer={<>নতুন ডাক্তার? <Link href="/register">ফ্রি অ্যাকাউন্ট খুলুন</Link></>}>
      <LoginForm />
    </AuthShell>
  );
}
