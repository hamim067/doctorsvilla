import { NextResponse } from "next/server";
import { runFollowUpJob } from "@/lib/followup";

// Vercel Cron প্রতিদিন চালাবে (vercel.json) — Authorization: Bearer CRON_SECRET
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runFollowUpJob();
  return NextResponse.json(result);
}
