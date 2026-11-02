import Link from "next/link";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "ডাক্তার রেজিস্ট্রেশন" };

export default function RegisterPage() {
  return (
    <main className="narrow stack" style={{ maxWidth: 680, paddingTop: 48 }}>
      <Link href="/" style={{ fontSize: 22, fontWeight: 700 }}>DoctorOS</Link>
      <h1>ডাক্তার হিসেবে অ্যাকাউন্ট খুলুন</h1>
      <p className="muted">প্রোফাইল, অনলাইন সিরিয়াল আর লাইভ ট্র্যাকিং — কয়েক মিনিটে চালু।</p>
      <RegisterForm />
      <p className="muted">আগেই অ্যাকাউন্ট আছে? <Link href="/login">লগইন</Link></p>
    </main>
  );
}
