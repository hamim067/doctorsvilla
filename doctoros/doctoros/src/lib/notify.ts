import "server-only";
import { db, schema } from "@/db";

/**
 * রোগীর কাছে মেসেজ পাঠানো।
 *
 * খরচ কমানোর নিয়ম (PRD §১৭–১৮): অ্যাপ থাকলে আগে পুশ নোটিফিকেশন (ফ্রি),
 * না পারলে হোয়াটসঅ্যাপ, শেষে এসএমএস। প্রথম ভার্সনে রোগীর অ্যাপ নেই,
 * তাই আপাতত শুধু এসএমএস চ্যানেল চালু; পুশ/হোয়াটসঅ্যাপ যোগ হবে channels তালিকায়।
 *
 * SMS_PROVIDER:
 *   "console" — কিছু পাঠায় না, শুধু লগ করে (ডেভেলপমেন্ট ও টেস্টিং)
 *   "http"    — বাংলাদেশি এসএমএস গেটওয়ের HTTP API (SMS_API_URL, SMS_API_KEY, SMS_SENDER_ID)
 *               গেটওয়ে ভেদে প্যারামিটারের নাম আলাদা হতে পারে — sendHttpSms() মিলিয়ে নিন।
 */
type Purpose = "booking" | "followup" | "holiday" | "queue";

export async function notifyPatient(opts: { doctorId: string | null; phone: string; body: string; purpose: Purpose }) {
  const provider = process.env.SMS_PROVIDER ?? "console";
  let status = "logged";
  let error: string | null = null;

  if (provider === "http") {
    try {
      await sendHttpSms(opts.phone, opts.body);
      status = "sent";
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message : String(e);
    }
  } else {
    console.log(`[SMS → ${opts.phone}] ${opts.body}`);
  }

  await db.insert(schema.messageLogs).values({
    doctorId: opts.doctorId,
    to: opts.phone,
    channel: "sms",
    purpose: opts.purpose,
    body: opts.body,
    status,
    error,
  });
  return status;
}

async function sendHttpSms(phone: string, message: string) {
  const url = process.env.SMS_API_URL;
  if (!url) throw new Error("SMS_API_URL সেট করা নেই");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.SMS_API_KEY,
      senderid: process.env.SMS_SENDER_ID,
      number: toInternational(phone),
      message,
    }),
  });
  if (!res.ok) throw new Error(`SMS gateway ${res.status}`);
}

/** 01712345678 → 8801712345678 */
export function toInternational(phone: string) {
  return phone.startsWith("880") ? phone : `88${phone}`;
}
