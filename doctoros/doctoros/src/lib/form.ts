/** সার্ভার অ্যাকশনের ফলাফল — ফর্মে এরর দেখানোর জন্য */
export type FormState = { error?: string; ok?: string } | undefined;

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const int = (fd: FormData, k: string) => {
  const n = parseInt(str(fd, k), 10);
  return Number.isFinite(n) ? n : null;
};
