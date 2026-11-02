import Link from "next/link";

export function ChamberTabs({ chambers, current, base }: { chambers: { id: string; name: string }[]; current: string; base: string }) {
  if (chambers.length < 2) return null;
  return (
    <nav className="row" aria-label="চেম্বার">
      {chambers.map((c) => (
        <Link key={c.id} href={`${base}?chamber=${c.id}`} className={c.id === current ? "btn btn-primary" : "btn"} aria-current={c.id === current ? "page" : undefined}>{c.name}</Link>
      ))}
    </nav>
  );
}
