import { NextResponse } from "next/server";
import { bookingLive } from "@/lib/live";

// মোবাইল অ্যাপ বা অন্য কোনো ক্লায়েন্ট এখান থেকে লাইভ সিরিয়াল নেবে (রোগীর ফোন নাম্বার এখানে নেই)
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const data = await bookingLive((await params).id);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
