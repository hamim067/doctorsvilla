import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "ডাক্তার রেজিস্ট্রেশন" };

export default function RegisterPage() {
  return (
    <AuthShell title="ডাক্তার হিসেবে অ্যাকাউন্ট খুলুন" sub="প্রোফাইল, অনলাইন সিরিয়াল আর লাইভ ট্র্যাকিং — কয়েক মিনিটে চালু।" footer={<>আগেই অ্যাকাউন্ট আছে? <Link href="/login">লগইন</Link></>}>
      <RegisterForm />
    </AuthShell>
  );
}
