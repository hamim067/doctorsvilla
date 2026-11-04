import Link from "next/link";
import { VitalsPanel } from "@/components/Vitals";
import { familyOf, requirePatient } from "@/lib/patient-auth";
import { toRow, vitalsForPatients } from "@/lib/vitals";
import { addMyVital } from "../../actions";

export const metadata = { title: "আমার স্বাস্থ্য" };
export const dynamic = "force-dynamic";

/** প্রেসার, সুগার, ওজন — রোগী নিজে লেখেন, ডাক্তারের লেখাও এখানে দেখায় */
export default async function Health({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const s = await requirePatient();
  const fam = await familyOf(s.accountId);
  if (!fam.length) return <div className="md-card"><p>আগে <Link href="/me/family">সদস্য যোগ করুন</Link>।</p></div>;
  const { p } = await searchParams;
  const me = fam.find((x) => x.id === p) ?? fam[0];
  const rows = (await vitalsForPatients([me.id], 200)).map(({ v, doctorName }) => toRow(v, v.source === "PATIENT" ? "নিজে" : doctorName ?? "ডাক্তার"));
  return (
    <div className="md">
      <div className="col" style={{ gap: 4 }}>
        <h1>স্বাস্থ্যের হিসাব</h1>
        <span className="muted small">প্রেসার, সুগার আর ওজন তারিখ দিয়ে লিখে রাখুন — গ্রাফে দেখবেন কেমন যাচ্ছে, আর ডাক্তারও ভিজিটের সময় দেখতে পাবেন।</span>
      </div>
      {fam.length > 1 && (
        <nav className="me-chips" aria-label="সদস্য">
          {fam.map((m) => <Link key={m.id} href={`/me/health?p=${m.id}`} className={m.id === me.id ? "on" : ""}>{m.name}</Link>)}
        </nav>
      )}
      <section className="md-card">
        <VitalsPanel key={me.id} rows={rows} action={addMyVital.bind(null, me.id)} intro={`${me.name}-এর রিডিং`} />
      </section>
    </div>
  );
}
