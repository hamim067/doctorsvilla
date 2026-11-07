import Link from "next/link";

export const metadata = { title: "পাতা পাওয়া যায়নি" };

/** ভুল লিংক বা মুছে ফেলা পাতা — বাংলায়, ফেরার পথসহ */
export default function NotFound() {
  return (
    <main className="nf">
      <div className="nf-card">
        <span className="nf-code">৪০৪</span>
        <h1>পাতাটা পাওয়া যায়নি</h1>
        <p>লিংকটা হয়তো ভুল, অথবা পাতাটা সরিয়ে ফেলা হয়েছে। ডাক্তারের লিংক হলে বানানটা আরেকবার মিলিয়ে দেখুন।</p>
        <div className="nf-btns">
          <Link href="/" className="btn btn-primary">মূল পাতায় যান</Link>
          <Link href="/me" className="btn">আমার অ্যাকাউন্ট</Link>
        </div>
      </div>
    </main>
  );
}
