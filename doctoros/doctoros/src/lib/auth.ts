import "server-only";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";

const COOKIE = "dos_session";
const MAX_AGE = 60 * 60 * 24 * 30; // ৩০ দিন — চেম্বারের কম্পিউটারে বারবার লগইন যেন না লাগে

export type Session = { uid: string; role: "DOCTOR" | "ASSISTANT" | "ADMIN"; doctorId: string; name: string };

function key() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET কমপক্ষে ৩২ অক্ষরের হতে হবে");
  return new TextEncoder().encode(s);
}

export const hashPassword = (p: string) => bcrypt.hash(p, 10);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

export async function createSession(s: Session) {
  const token = await new SignJWT(s).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

/** স্টাফ (ডাক্তার/অ্যাসিস্ট্যান্ট) না হলে লগইনে পাঠায়; ইউজার মুছে গেলেও আটকায় */
export async function requireStaff(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  const [u] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, s.uid)).limit(1);
  if (!u) redirect("/login");
  return s;
}

/** শুধু ডাক্তার নিজে (যেমন চেম্বার সেটিং, স্টাফ যোগ) */
export async function requireDoctor(): Promise<Session> {
  const s = await requireStaff();
  if (s.role !== "DOCTOR" && s.role !== "ADMIN") redirect("/dashboard?denied=1");
  return s;
}
