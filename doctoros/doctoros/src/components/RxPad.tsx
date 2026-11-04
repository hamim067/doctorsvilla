import { COLORS, LABELS, type PadData, type PadSettings } from "@/lib/rxpad";

const bn = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);

/** স্টেথোস্কোপ-হার্ট — লোগো আর জলছাপ */
function Steth({ size = 64, stroke = "currentColor", sw = 3 }: { size?: number; stroke?: string; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 6v14a12 12 0 0 0 24 0V6" />
      <path d="M10 6h8M34 6h8" />
      <path d="M26 32v6c0 8 4 14 11 16 6 2 11-1 12-6 1-6-4-9-8-7-4 2-4 7 0 9 5 3 12 0 13-8v-6" />
      <circle cx="54" cy="26" r="6" />
    </svg>
  );
}
function Rx({ color }: { color: string }) {
  return <span className="rp-rx" style={{ color }} aria-label="Rx">R<sub>x</sub></span>;
}

/**
 * প্রেসক্রিপশন প্যাড — ডাক্তারের বাছা ফরম্যাট অনুযায়ী।
 * অংশ: হেডার · চেম্বার · রোগীর তথ্য · শারীরিক মাপ · রোগ নির্ণয় · Rx · পরামর্শ · পরীক্ষা · পরবর্তী সাক্ষাৎ · স্বাক্ষর
 */
export function RxPad({ s, d }: { s: PadSettings; d: PadData }) {
  const L = LABELS[s.labels];
  const c = COLORS[s.color];
  const S = s.sections;
  const v = d.visit;
  const vit = d.vitals;
  const vitList = vit ? ([["bp", vit.bp], ["pulse", vit.pulse], ["weight", vit.weight], ["temp", vit.temp], ["spo2", vit.spo2]] as const).filter(([, x]) => x) : [];
  const style = { "--rp-a": c.a, "--rp-b": c.b, "--rp-soft": c.soft, ...(s.template === "preprinted" ? { "--rp-top": `${s.topMm}mm`, "--rp-bottom": `${s.bottomMm}mm` } : {}) } as React.CSSProperties;
  const age = d.patient.age ? `${bn(d.patient.age)} ${L.years}` : "";

  const meds = (
    <div className="rp-meds">
      {(v?.medicines ?? []).map((m, i) => (
        <div key={i} className="rp-med">
          <b>{bn(i + 1)}. {m.name}</b>
          <span>{[m.dose, m.when, m.days].filter(Boolean).join(" — ")}</span>
        </div>
      ))}
    </div>
  );
  const vitalsBlock = S.vitals && vitList.length > 0 && (
    <div className="rp-block rp-vit"><h4>{L.vitals}</h4>{vitList.map(([k, x]) => <div key={k} className="rp-kv"><span>{L[k]}</span><b>{x}</b></div>)}</div>
  );
  const ccBlock = <div className="rp-block"><h4>{L.cc}</h4><p>{v?.complaint || ""}</p></div>;
  const dxBlock = <div className="rp-block"><h4>{L.dx}</h4><p>{v?.diagnosis || ""}</p></div>;
  const invBlock = S.investigation && <div className="rp-block"><h4>{L.inv}</h4><p className="pre">{v?.investigations || ""}</p></div>;
  const advBlock = S.advice && v?.advice && <div className="rp-block rp-adv"><h4>{L.adv}</h4><p className="pre">{v.advice}</p></div>;
  const fuBlock = S.followup && v?.followUp && <div className="rp-fu">{L.fu}: <b>{v.followUp}</b></div>;
  const sign = S.signature && <div className="rp-sign"><span />{L.sign}</div>;
  const qr = S.qr && d.qrSvg && (
    <div className="rp-qr"><div dangerouslySetInnerHTML={{ __html: d.qrSvg }} /><span>{L.qr}</span></div>
  );
  const water = S.watermark && <div className="rp-water"><Steth size={260} sw={1.6} /></div>;
  const patientRow = (
    <div className="rp-pt">
      <span><i>{L.name}:</i> <b>{d.patient.name}</b></span>
      {age && <span><i>{L.age}:</i> {age}</span>}
      {d.patient.gender && <span><i>{L.sex}:</i> {d.patient.gender}</span>}
      <span><i>{L.id}:</i> {d.patient.code}</span>
      {d.serial && <span><i>{L.serial}:</i> {d.serial}</span>}
      <span><i>{L.date}:</i> {d.date}</span>
    </div>
  );
  const hospitalName = s.hospital || d.chamber?.name || "";
  const address = d.chamber ? `${d.chamber.address}, ${d.chamber.city}` : "";

  /* ---------- ১. আধুনিক কোণ (প্রথম ছবি) ---------- */
  if (s.template === "teal") {
    return (
      <div className={`rp t-teal p-${s.paper}`} style={style}>
        <header className="rp-h">
          <div className="rp-doc">
            <h1>{d.doctor.name}</h1>
            <div className="rp-qual">{d.doctor.degrees}</div>
            <p>{d.doctor.specialty}</p>
            <p>{L.bmdc}: {d.doctor.bmdcNo}</p>
          </div>
          <span className="rp-diag" aria-hidden />
          <div className="rp-hosp">
            <h2>{hospitalName}</h2>
            {s.slogan && <div className="rp-slogan">{s.slogan}</div>}
            {address && <p>{address}</p>}
          </div>
        </header>
        <div className="rp-bars" aria-hidden><span /><span /></div>
        <div className="rp-main">
          <aside className="rp-side">
            {ccBlock}{dxBlock}{vitalsBlock}{invBlock}
          </aside>
          <section className="rp-body">
            {patientRow}
            {water}
            <Rx color={c.b} />
            {meds}
            {advBlock}
            {fuBlock}
            <div className="rp-end">{qr}{sign}</div>
          </section>
        </div>
        <footer className="rp-f">
          <div className="rp-call">{s.phone ? <><small>{L.call}</small><b>{s.phone}</b></> : <b>{d.doctor.name}</b>}</div>
          <div className="rp-contact">
            {address && <span><i />{address}</span>}
            {(s.website || d.url) && <span><i />{s.website || d.url?.replace(/^https?:\/\//, "")}</span>}
          </div>
        </footer>
      </div>
    );
  }

  /* ---------- ২. নীল মিনিমাল (দ্বিতীয় ছবি) ---------- */
  if (s.template === "blue") {
    return (
      <div className={`rp t-blue p-${s.paper}`} style={style}>
        <header className="rp-h">
          <span className="rp-logo"><Steth size={86} stroke={c.a} sw={2.6} /></span>
          <div className="rp-doc">
            <h1>{d.doctor.name}</h1>
            <div className="rp-qual">{d.doctor.degrees}</div>
            <span className="rp-line" />
            <div className="rp-hrow">
              <p>{d.doctor.specialty} · {L.bmdc}: {d.doctor.bmdcNo}</p>
              <div className="rp-hosp"><h2>{hospitalName}</h2>{s.slogan && <small>{s.slogan}</small>}</div>
            </div>
          </div>
        </header>
        <div className="rp-band">
          <div className="rp-ln w2"><i>{L.name}:</i><b>{d.patient.name}</b></div>
          <div className="rp-ln"><i>{L.id}:</i><b>{d.patient.code}</b></div>
          <div className="rp-ln"><i>{L.age}:</i><b>{age}{d.patient.gender ? ` · ${d.patient.gender}` : ""}</b></div>
          <div className="rp-ln"><i>{L.date}:</i><b>{d.date}</b></div>
          <div className="rp-ln w2"><i>{L.dx}:</i><b>{v?.diagnosis || ""}</b></div>
        </div>
        <section className="rp-body">
          <div className="rp-two">
            <div className="rp-col">
              <Rx color={c.a} />
              {meds}
              {advBlock}
              {fuBlock}
            </div>
            <aside className="rp-side">
              {v?.complaint && ccBlock}
              {vitalsBlock}
              {invBlock}
            </aside>
          </div>
          <div className="rp-end">{qr}{sign}</div>
        </section>
        <footer className="rp-f">
          {s.phone && <span><Ico k="phone" />{s.phone}</span>}
          {s.email && <span><Ico k="mail" />{s.email}</span>}
          {address && <span><Ico k="pin" />{address}</span>}
          {(s.website || d.url) && <span><Ico k="web" />{s.website || d.url?.replace(/^https?:\/\//, "")}</span>}
        </footer>
        <svg className="rp-curl" viewBox="0 0 200 200" aria-hidden><path d="M200 60c-50 0-70 40-50 70s60 20 50-20-80-50-110 0-20 110 40 120" fill="none" stroke={c.a} strokeWidth="10" opacity="0.55" strokeLinecap="round" /></svg>
      </div>
    );
  }

  /* ---------- ৩. ছাপানো প্যাড — উপরে-নিচে ফাঁকা, শুধু লেখা ---------- */
  if (s.template === "preprinted") {
    return (
      <div className={`rp t-pre p-${s.paper}`} style={style}>
        {patientRow}
        <div className="rp-main">
          <aside className="rp-side">{ccBlock}{dxBlock}{vitalsBlock}{invBlock}</aside>
          <section className="rp-body"><Rx color="#222" />{meds}{advBlock}{fuBlock}</section>
        </div>
      </div>
    );
  }

  /* ---------- ৪. ক্লাসিক ---------- */
  return (
    <div className={`rp t-classic p-${s.paper}`} style={style}>
      <header className="rp-h">
        <div className="rp-doc">
          <h1>{d.doctor.name}</h1>
          <div className="rp-qual">{d.doctor.degrees}</div>
          <p>{d.doctor.specialty} · {L.bmdc}: {d.doctor.bmdcNo}</p>
        </div>
        <div className="rp-hosp">
          <h2>{hospitalName}</h2>
          {address && <p>{address}</p>}
          {s.phone && <p>{s.phone}</p>}
        </div>
      </header>
      {patientRow}
      <div className="rp-main">
        <aside className="rp-side">{ccBlock}{dxBlock}{vitalsBlock}{invBlock}</aside>
        <section className="rp-body">{water}<Rx color={c.a} />{meds}{advBlock}{fuBlock}<div className="rp-end">{qr}{sign}</div></section>
      </div>
    </div>
  );
}

function Ico({ k }: { k: "phone" | "mail" | "pin" | "web" }) {
  const P = {
    phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z",
    mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM22 7l-10 6L2 7",
    pin: "M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
    web: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z",
  };
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={P[k]} /></svg>;
}
