/** সার্ভার অ্যাকশনের ফলাফল — ফর্মে এরর দেখানোর জন্য */
export type FormState = { error?: string; ok?: string } | undefined;

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
/** সংখ্যা পড়া — বাংলা সংখ্যা (৮০০), কমা (1,000), ৳ চিহ্ন সব মেনে নেয় */
export const int = (fd: FormData, k: string) => {
  const raw = str(fd, k).replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/[,\s৳]/g, "");
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
};
