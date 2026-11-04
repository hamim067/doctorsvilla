// ডাক্তারের নিজের লেখার অভ্যাস — কোন ওষুধ কোন ডোজে বেশি লেখেন, কোন অভিযোগ/পরীক্ষা/পরামর্শ বারবার আসে
import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

export type MedHabit = { name: string; dose: string; when: string; days: string; n: number };
export type Habits = { meds: MedHabit[]; complaints: string[]; diagnoses: string[]; tests: string[]; advice: string[] };

const START = {
  complaints: ["জ্বর", "কাশি", "মাথা ব্যথা", "মাথা ঘোরা", "বুক ব্যথা", "বুক ধড়ফড়", "শ্বাসকষ্ট", "পেট ব্যথা", "দুর্বলতা"],
  diagnoses: ["উচ্চ রক্তচাপ", "টাইপ-২ ডায়াবেটিস", "ভাইরাল জ্বর", "গ্যাস্ট্রাইটিস"],
  tests: ["CBC", "ECG", "RBS", "FBS", "HbA1c", "Lipid profile", "S. Creatinine", "Urine R/E", "X-ray chest"],
  advice: ["লবণ কম খাবেন", "প্রতিদিন ৩০ মিনিট হাঁটবেন", "মিষ্টি ও চিনি বাদ", "প্রচুর পানি পান করবেন", "তৈলাক্ত খাবার কম খাবেন"],
};

/** "a, b। c" → ["a","b","c"] */
export const splitItems = (s: string | null | undefined, re = /[,،;।\n]+/) => (s ?? "").split(re).map((x) => x.trim()).filter(Boolean);

function top(values: string[], k: number, start: string[]) {
  const c = new Map<string, { v: string; n: number }>();
  for (const v of values) { const key = v.toLowerCase(); const e = c.get(key); if (e) e.n++; else c.set(key, { v, n: 1 }); }
  const mine = [...c.values()].sort((a, b) => b.n - a.n).map((x) => x.v).slice(0, k);
  // নতুন ডাক্তারের জন্য সাধারণ কিছু দিয়ে শুরু — নিজেরগুলো আগে
  const seen = new Set(mine.map((x) => x.toLowerCase()));
  return [...mine, ...start.filter((x) => !seen.has(x.toLowerCase()))].slice(0, k);
}

export async function doctorHabits(doctorId: string): Promise<Habits> {
  const [medRows, recent] = await Promise.all([
    db.execute<MedHabit>(sql`
      select name, dose, "when", days, n from (
        select m->>'name' as name, coalesce(m->>'dose','') as dose, coalesce(m->>'when','') as "when", coalesce(m->>'days','') as days, count(*)::int as n,
          row_number() over (partition by lower(m->>'name') order by count(*) desc) as rn
        from visits v, jsonb_array_elements(v.medicines) m
        where v.doctor_id = ${doctorId} and coalesce(m->>'name','') <> ''
        group by 1, 2, 3, 4) t
      where rn = 1 order by n desc, name limit 500`),
    db.select({ c: schema.visits.complaint, d: schema.visits.diagnosis, i: schema.visits.investigations, a: schema.visits.advice })
      .from(schema.visits).where(eq(schema.visits.doctorId, doctorId)).orderBy(desc(schema.visits.createdAt)).limit(400),
  ]);
  return {
    meds: medRows.rows.map((r) => ({ ...r, n: Number(r.n) })),
    complaints: top(recent.flatMap((r) => splitItems(r.c)), 12, START.complaints),
    diagnoses: top(recent.flatMap((r) => splitItems(r.d)), 10, START.diagnoses),
    tests: top(recent.flatMap((r) => splitItems(r.i)), 14, START.tests),
    advice: top(recent.flatMap((r) => splitItems(r.a, /[,،;।\n]+/)), 10, START.advice),
  };
}
