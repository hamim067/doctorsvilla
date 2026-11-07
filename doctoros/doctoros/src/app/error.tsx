"use client";
import Link from "next/link";
import { useEffect } from "react";

/** অপ্রত্যাশিত সমস্যা হলে — ইংরেজি ত্রুটির বদলে বাংলায় বোঝানো আর আবার চেষ্টার বোতাম */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="nf">
      <div className="nf-card">
        <span className="nf-code">!</span>
        <h1>কিছু একটা সমস্যা হয়েছে</h1>
        <p>আপনার লেখা বা তথ্য হারায়নি। একটু পরে আবার চেষ্টা করুন। বারবার হলে নিচের কোডটা আমাদের জানান।</p>
        {error.digest && <code className="nf-digest">{error.digest}</code>}
        <div className="nf-btns">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>আবার চেষ্টা করুন</button>
          <Link href="/" className="btn">মূল পাতায় যান</Link>
        </div>
      </div>
    </main>
  );
}
