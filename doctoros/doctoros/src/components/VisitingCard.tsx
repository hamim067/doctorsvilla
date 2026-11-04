import { COLORS } from "@/lib/rxpad";
import type { CardData, CardSettings } from "@/lib/vcard";

function I({ k }: { k: "phone" | "pin" | "web" | "clock" | "shield" }) {
  const P = {
    phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z",
    pin: "M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
    web: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z",
    clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10ZM9 12l2 2 4-4",
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={P[k]} /></svg>;
}
function Mark() {
  return <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 6v14a12 12 0 0 0 24 0V6M10 6h8M34 6h8M26 32v6c0 8 4 14 11 16 6 2 11-1 12-6 1-6-4-9-8-7" /><circle cx="54" cy="26" r="6" /></svg>;
}

/** ভিজিটিং কার্ড — ৮৫×৫৫ মিমি; side="back" দিলে পেছনের দিক (চেম্বার, সময়, QR) */
export function VisitingCard({ s, d, side = "front" }: { s: CardSettings; d: CardData; side?: "front" | "back" }) {
  const c = COLORS[s.color];
  const F = s.fields;
  const style = { "--vc-a": c.a, "--vc-b": c.b, "--vc-soft": c.soft } as React.CSSProperties;
  const logo = s.showLogo && d.logoUrl ? <img className="vk-logo" src={d.logoUrl} alt="" /> : <span className="vk-mark"><Mark /></span>;
  const site = (d.website || d.url).replace(/^https?:\/\//, "");
  const ch = d.chambers[0];
  const qr = F.qr && d.qrSvg ? <div className="vk-qr" dangerouslySetInnerHTML={{ __html: d.qrSvg }} /> : null;

  if (side === "back") {
    return (
      <div className="vk vk-back" style={style}>
        <div className="vk-back-l">
          <b className="vk-back-t">চেম্বার ও সময়</b>
          {d.chambers.slice(0, 3).map((x) => (
            <div key={x.name} className="vk-ch">
              <b>{x.name}</b>
              <span><I k="pin" />{x.address}, {x.city}</span>
              {x.schedule && <span><I k="clock" />{x.schedule}</span>}
            </div>
          ))}
          {d.phone && <span className="vk-back-phone"><I k="phone" />সিরিয়াল: {d.phone}</span>}
        </div>
        {d.qrSvg && <div className="vk-back-r"><div className="vk-qr" dangerouslySetInnerHTML={{ __html: d.qrSvg }} /><small>স্ক্যান করে<br />অনলাইনে সিরিয়াল</small></div>}
      </div>
    );
  }

  const info = (
    <div className="vk-info">
      {F.phone && d.phone && <span><I k="phone" />{d.phone}</span>}
      {F.chamber && ch && <span><I k="pin" />{s.template === "band" ? `${ch.name}, ${ch.city}` : `${d.hospital || ch.name}, ${ch.city}`}</span>}
      {F.schedule && ch?.schedule && <span><I k="clock" />{ch.schedule}</span>}
      {F.website && <span><I k="web" />{site}</span>}
    </div>
  );
  const who = (
    <div className="vk-who">
      <b className="vk-name">{d.name}</b>
      {F.degrees && <span className="vk-deg">{d.degrees}</span>}
      {F.specialty && <span className="vk-spec">{d.specialty}</span>}
      {s.tagline && <span className="vk-tag">{s.tagline}</span>}
      {F.bmdc && <span className="vk-bmdc"><I k="shield" />BMDC: {d.bmdcNo}</span>}
    </div>
  );

  if (s.template === "corner") return (
    <div className="vk t-corner" style={style}>
      <div className="vk-side">{logo}</div>
      <div className="vk-main">{who}{info}</div>
      {qr && <div className="vk-qr-s">{qr}</div>}
    </div>
  );
  if (s.template === "minimal") return (
    <div className="vk t-minimal" style={style}>
      <div className="vk-top">{logo}{who}</div>
      <span className="vk-rule" />
      <div className="vk-bot">{info}{qr}</div>
    </div>
  );
  if (s.template === "dark") return (
    <div className="vk t-dark" style={style}>
      <div className="vk-main">{logo}{who}<span className="vk-rule" />{info}</div>
      {qr && <div className="vk-qr-s">{qr}</div>}
    </div>
  );
  if (s.template === "qr") return (
    <div className="vk t-qr" style={style}>
      <div className="vk-main">{who}{info}</div>
      <div className="vk-qrpanel">{d.qrSvg ? <div className="vk-qr" dangerouslySetInnerHTML={{ __html: d.qrSvg }} /> : logo}<small>স্ক্যান করে<br />সিরিয়াল নিন</small></div>
    </div>
  );
  return (
    <div className="vk t-band" style={style}>
      <div className="vk-bandtop">{logo}{who}</div>
      <div className="vk-bot">{info}{qr}</div>
    </div>
  );
}
