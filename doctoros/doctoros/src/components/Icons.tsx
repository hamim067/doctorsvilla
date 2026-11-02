/** বিভাগ ও ফিচারের আইকন (stroke SVG) */
export const ICON = {
  heart: "M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z",
  tooth: "M7 3c-2.2 0-4 1.8-4 4.2 0 2 .8 3.2 1.4 4.6.6 1.5.7 3.4 1.1 5.6C5.9 19.6 6.6 21 7.6 21c1.4 0 1.6-2.4 2.1-4.4.3-1.1.9-1.6 2.3-1.6s2 .5 2.3 1.6c.5 2 .7 4.4 2.1 4.4 1 0 1.7-1.4 2.1-3.6.4-2.2.5-4.1 1.1-5.6.6-1.4 1.4-2.6 1.4-4.6C21 4.8 19.2 3 17 3c-1.9 0-2.9 1-5 1S8.9 3 7 3Z",
  child: "M9 12h.01M15 12h.01M10 16c.6.4 1.2.6 2 .6s1.4-.2 2-.6M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
  steth: "M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 12 0V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3M8 15v1a6 6 0 0 0 12 0v-4M22 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  ear: "M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4",
  skin: "M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2Z",
  gyn: "M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM12 15v7M9 19h6",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10ZM9 12l2 2 4-4",
  pulse: "M3 12h4l2-5 4 10 2-5h6",
  bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0",
  family: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-3.5-3.5",
  pin: "M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  check: "M20 6 9 17l-5-5",
  arrow: "M5 12h14M13 6l6 6-6 6",
  chevron: "m9 18 6-6-6-6",
  plus: "M12 5v14M5 12h14",
} as const;

export function Icon({ name, size = 22, stroke = 2, color = "currentColor" }: { name: keyof typeof ICON; size?: number; stroke?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON[name]} />
    </svg>
  );
}
