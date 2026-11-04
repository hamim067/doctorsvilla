import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireDoctor } from "@/lib/auth";
import { removeAssistant, setAssistantRx } from "./actions";
import { AssistantForm } from "./AssistantForm";
import { ResetPassword } from "./ResetPassword";

export const metadata = { title: "অ্যাসিস্ট্যান্ট" };

export default async function StaffPage() {
  const s = await requireDoctor();
  const staff = await db
    .select({ id: schema.users.id, name: schema.users.name, phone: schema.users.phone })
    .from(schema.users)
    .where(and(eq(schema.users.doctorId, s.doctorId), eq(schema.users.role, "ASSISTANT")));
  const [doc] = await db.select({ rx: schema.doctors.assistantRxAccess }).from(schema.doctors).where(eq(schema.doctors.id, s.doctorId)).limit(1);
  return (
    <>
      <h1>অ্যাসিস্ট্যান্ট</h1>
      <p className="muted">অ্যাসিস্ট্যান্ট সিরিয়াল কিউ, রোগী খোঁজা, ফলোআপ আর রোগীর প্রেসার/সুগার লেখা — এগুলো পারবেন; আয়, রিপোর্ট, চেম্বার সেটিং আর ওয়েবসাইট দেখতে পারবেন না।</p>

      <section className="card stack-sm" aria-label="প্রেসক্রিপশনের অনুমতি">
        <div className="row between" style={{ alignItems: "flex-start" }}>
          <div className="stack-sm" style={{ gap: 2, flex: 1, minWidth: 220 }}>
            <h2>প্রেসক্রিপশন দেখার অনুমতি</h2>
            <span className="muted small">{doc?.rx
              ? "এখন অ্যাসিস্ট্যান্টরা রোগীর প্রেসক্রিপশন দেখতে, লিখতে (আপনার বলা অনুযায়ী) আর প্রিন্ট করতে পারবেন।"
              : "এখন অ্যাসিস্ট্যান্টরা কোনো প্রেসক্রিপশন দেখতে পারবেন না — শুধু আপনি দেখবেন। (প্রস্তাবিত)"}</span>
          </div>
          <form action={setAssistantRx}>
            <input type="hidden" name="allow" value={doc?.rx ? "0" : "1"} />
            <button className={doc?.rx ? "btn" : "btn btn-primary"}>{doc?.rx ? "অনুমতি তুলে নিন" : "অনুমতি দিন"}</button>
          </form>
        </div>
        <span className={`badge ${doc?.rx ? "badge-orange" : "badge-teal"}`} style={{ alignSelf: "flex-start" }}>{doc?.rx ? "অনুমতি দেওয়া আছে" : "অনুমতি বন্ধ"}</span>
      </section>
      {staff.length > 0 && (
        <div className="table-wrap"><table>
          <thead><tr><th>নাম</th><th>মোবাইল</th><th>পাসওয়ার্ড ভুলে গেলে</th><th></th></tr></thead>
          <tbody>{staff.map((u) => (
            <tr key={u.id}><td>{u.name}</td><td>{u.phone}</td><td><ResetPassword id={u.id} /></td>
              <td><form action={removeAssistant}><input type="hidden" name="id" value={u.id} /><button className="btn" style={{ minHeight: 36 }}>সরিয়ে দিন</button></form></td></tr>
          ))}</tbody>
        </table></div>
      )}
      <AssistantForm />
    </>
  );
}
