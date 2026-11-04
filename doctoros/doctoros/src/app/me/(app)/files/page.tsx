import Link from "next/link";
import { Icon } from "@/components/Icons";
import { patientCode } from "@/lib/booking";
import { currentMeds } from "@/lib/meds";
import { familyOf, requirePatient, selectedMember } from "@/lib/patient-auth";
import { memberRx } from "@/lib/patient-rx";
import { bn, formatDateBn, today } from "@/lib/time";
import "../rx.css";

export const metadata = { title: "প্রেসক্রিপশন" };
export const dynamic = "force-dynamic";

/** প্রেসক্রিপশনের তালিকা — উপরে এখন চলা ওষুধ, তারপর ডাক্তার বাছাই আর বছর ধরে ছোট কার্ড */
export default async function MyFiles({ searchParams }: { searchParams: Promise<{ dr?: string }> }) {
  const s = await requirePatient();
  const fam = await familyOf(s.accountId);
  if (!fam.length) return <div className="md-card"><p>আগে <Link href="/me/family">সদস্য যোগ করুন</Link>।</p></div>;
  const me = (await selectedMember(fam))!;
  const all = await memberRx(me.id);
  const t = today();
  const drWanted = (await searchParams).dr;
  const doctors = [...new Map(all.map((r) => [r.doctorId, { id: r.doctorId, name: r.doctorName, n: all.filter((x) => x.doctorId === r.doctorId).length }])).values()];
  const dr = doctors.find((d) => d.id === drWanted)?.id;
  const rows = dr ? all.filter((r) => r.doctorId === dr) : all;
  const meds = currentMeds(all.map((r) => ({ date: r.date, medicines: r.v.medicines, doctorName: r.doctorName })), t);
  const years = [...new Set(rows.map((r) => r.date.slice(0, 4)))];
  const latestId = all[0]?.v.id;

  return (
    <div className="md rxl">
      <div className="col" style={{ gap: 4 }}>
        <h1>প্রেসক্রিপশন</h1>
        <span className="muted">{me.name} · {patientCode(me.number)} — ডাক্তার যা লিখেছেন সব এখানে। চাপ দিলে পুরোটা খুলবে।</span>
      </div>

      {meds.length > 0 && (
        <section className="rxl-now" aria-label="এখন যে ওষুধ চলছে">
          <h2><Icon name="pill" size={20} />এখন যে ওষুধ চলছে</h2>
          <ul>
            {meds.slice(0, 6).map((m) => (
              <li key={m.name}>
                <b>{m.name}</b>
                <span>{[m.dose, m.when].filter(Boolean).join(" · ")}</span>
                <em className={m.daysLeft !== null && m.daysLeft !== Infinity && m.daysLeft <= 3 ? "soon" : ""}>
                  {m.daysLeft === Infinity ? "নিয়মিত চলবে" : m.endDate ? `শেষ ${formatDateBn(m.endDate, false)}` : "দিন লেখা নেই"}
                </em>
              </li>
            ))}
          </ul>
          {meds.length > 6 && <span className="small">আরো {bn(meds.length - 6)}টি — হোম পেজে সকাল-দুপুর-রাত ভাগ করে দেখুন</span>}
        </section>
      )}

      {doctors.length > 1 && (
        <nav className="rxl-chips" aria-label="ডাক্তার বাছুন">
          <Link href="/me/files" className={!dr ? "on" : ""} scroll={false}>সব ডাক্তার <i>{bn(all.length)}</i></Link>
          {doctors.map((d) => <Link key={d.id} href={`?dr=${d.id}`} className={dr === d.id ? "on" : ""} scroll={false}>{d.name} <i>{bn(d.n)}</i></Link>)}
        </nav>
      )}

      {rows.length === 0 && <div className="md-card md-none">এখনো কোনো প্রেসক্রিপশন নেই। ডাক্তার লিখলে এখানে নিজে থেকেই চলে আসবে।</div>}

      {years.map((y) => (
        <section key={y} className="rxl-year">
          <h2 className="rxl-y">{bn(y)}</h2>
          <div className="rxl-list">
            {rows.filter((r) => r.date.startsWith(y)).map((r) => {
              const dx = r.v.diagnosis || r.v.complaint;
              const [, mo, da] = r.date.split("-");
              return (
                <Link key={r.v.id} href={`/me/files/${r.v.id}`} className="rxl-item">
                  <span className="rxl-date"><b>{bn(Number(da))}</b><small>{formatDateBn(r.date, false).split(" ")[1]}</small></span>
                  <span className="rxl-main">
                    <b>{dx || "প্রেসক্রিপশন"}</b>
                    <span>{r.doctorName}</span>
                    <span className="rxl-tags">
                      {r.v.medicines.length > 0 && <i><Icon name="pill" size={14} />{bn(r.v.medicines.length)}টি ওষুধ</i>}
                      {r.v.investigations && <i><Icon name="micro" size={14} />পরীক্ষা</i>}
                      {r.v.followUpDate && r.v.followUpDate >= t && <i className="fu"><Icon name="calendar" size={14} />আবার {formatDateBn(r.v.followUpDate, false)}</i>}
                      {r.v.id === latestId && <i className="new">সর্বশেষ</i>}
                    </span>
                  </span>
                  <Icon name="chevron" size={20} />
                  <span hidden>{mo}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
