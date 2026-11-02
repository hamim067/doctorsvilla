const MAP = {
  WAITING: ["অপেক্ষমাণ", "badge"],
  IN_PROGRESS: ["চলছে", "badge badge-orange"],
  DONE: ["সম্পন্ন", "badge badge-teal"],
  ABSENT: ["অনুপস্থিত", "badge badge-red"],
  CANCELLED: ["বাতিল", "badge"],
} as const;

export function StatusBadge({ status }: { status: keyof typeof MAP }) {
  const [label, cls] = MAP[status];
  return <span className={cls}>{label}</span>;
}
