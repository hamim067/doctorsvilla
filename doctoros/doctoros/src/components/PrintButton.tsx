"use client";
export function PrintButton({ label = "প্রিন্ট করুন" }: { label?: string }) {
  return <button type="button" className="btn btn-primary no-print" onClick={() => window.print()}>{label}</button>;
}
