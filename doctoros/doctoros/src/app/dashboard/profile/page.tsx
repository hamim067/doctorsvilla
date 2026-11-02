import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { db, schema } from "@/db";
import { requireStaff } from "@/lib/auth";
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
      <PasswordForm />
    </>
  );
}
