import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireDoctor } from "@/lib/auth";
import { removeAssistant } from "./actions";
import { AssistantForm } from "./AssistantForm";
import { ResetPassword } from "./ResetPassword";

export const metadata = { title: "অ্যাসিস্ট্যান্ট" };

export default async function StaffPage() {
  const s = await requireDoctor();
  const staff = await db
    .select({ id: schema.users.id, name: schema.users.name, phone: schema.users.phone })
    .from(schema.users)
    .where(and(eq(schema.users.doctorId, s.doctorId), eq(schema.users.role, "ASSISTANT")));
  return (
    <>
      <h1>অ্যাসিস্ট্যান্ট</h1>
      <p className="muted">অ্যাসিস্ট্যান্ট সিরিয়াল কিউ, রোগী খোঁজা আর ফলোআপ দেখতে পারবেন; চেম্বার সেটিং বদলাতে পারবেন না।</p>
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
