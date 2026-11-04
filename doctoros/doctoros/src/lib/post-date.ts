// ব্লগের তারিখ — "২০ অক্টোবর ২০২৬" / "20 Oct 2026" (সার্ভার ও ব্রাউজার দুজনেই)
const MON_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MON_BN = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const D = (s: string) => s.replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
export function postDate(date: string, lang: "bn" | "en") {
  const [y, m, d] = date.split("-").map(Number);
  return lang === "bn" ? D(`${d} ${MON_BN[m - 1]} ${y}`) : `${d} ${MON_EN[m - 1]} ${y}`;
}
