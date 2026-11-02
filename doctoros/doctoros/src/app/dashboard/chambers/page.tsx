import Link from "next/link";
import { requireDoctor } from "@/lib/auth";
import { doctorChambers } from "@/lib/chambers";
import { bn, formatTimeBn, WEEKDAYS_SHORT_BN } from "@/lib/time";
import { createChamber } from "./actions";
import { ChamberForm } from "./ChamberForm";

export const metadata = { title: "চেম্বার সেটিং" };

export default async function ChambersPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const s = await requireDoctor();
  const { welcome } = await searchParams;
  const list = await doctorChambers(s.doctorId);
  return (
    <>
      <h1>চেম্বার ও সময়সূচি</h1>
      {welcome && <p className="alert alert-ok">স্বাগতম! প্রথমে আপনার চেম্বার যোগ করুন — তারপরই রোগীরা অনলাইনে সিরিয়াল নিতে পারবেন।</p>}
      {list.length > 0 && (
        <div className="grid">
          {list.map((c) => (
            <Link key={c.id} href={`/dashboard/chambers/${c.id}`} className="card stack-sm" style={{ color: "inherit" }}>
              <span className="row between"><strong>{c.name}</strong><span className="badge badge-teal">{c.code}</span></span>
              <span className="muted small">{c.address}, {c.city}</span>
              <span className="small">
                {c.schedules.sort((a, b) => ((a.weekday + 1) % 7) - ((b.weekday + 1) % 7)).map((x) => WEEKDAYS_SHORT_BN[x.weekday]).join(" · ")}
                {c.schedules[0] && ` · ${formatTimeBn(c.schedules[0].startTime)}`}
              </span>
              <span className="small">ফি ৳{bn(c.feeNew)} · দিনে {bn(c.dailyLimit)} জন</span>
            </Link>
          ))}
        </div>
      )}
      <h2 style={{ marginTop: 12 }}>নতুন চেম্বার যোগ করুন</h2>
      <ChamberForm action={createChamber} submitLabel="চেম্বার যোগ করুন" />
    </>
  );
}
