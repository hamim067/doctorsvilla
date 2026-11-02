"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** পেজের ডেটা নির্দিষ্ট সময় পরপর নতুন করে আনে (অন্য কম্পিউটার/অনলাইন বুকিংয়ের পরিবর্তন দেখাতে) */
export function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
