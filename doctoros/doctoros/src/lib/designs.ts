/**
 * ডাক্তারের ওয়েবসাইটের টেমপ্লেট (ডিজাইন) তালিকা।
 *
 * সব টেমপ্লেট একই লেখা/ছবি/চেম্বার দেখায় — শুধু চেহারা আলাদা। তাই ডাক্তার ডিজাইন বদলালে
 * কিছু হারায় না, আর নতুন টেমপ্লেট বানাতে কোনো ব্যাকএন্ড কোড লাগে না।
 *
 * নতুন টেমপ্লেট যোগ করার নিয়ম (৩ ধাপ):
 *   ১. নিচের DESIGNS তালিকায় একটা লাইন যোগ করুন (id ছোট হাতের ইংরেজিতে, যেমন "sunrise")।
 *   ২. src/app/dr/designs.css-এ `.ws.d-sunrise …` দিয়ে শুধু CSS লিখুন (রং/ফন্ট/আকার/ছায়া)।
 *   ৩. `node scripts/design-thumbs.mjs` চালালে public/designs/sunrise.jpg ছবি তৈরি হয় — এডিটরে সেটাই দেখায়।
 */
export const DESIGNS = [
  { id: "modern", name: "আধুনিক", desc: "খিলান-আকারের ফ্রেমে ছবি, ভাসমান অভিজ্ঞতার ব্যাজ — সব বিশেষজ্ঞের জন্য।", theme: "navy", font: "anek", dots: ["#123B65", "#20A89E"] },
  { id: "clean", name: "পরিষ্কার", desc: "সাদা পাতা, মাঝখানে গোল ছবি, চিকন বর্ডার — কম সাজসজ্জা, দ্রুত পড়া যায়।", theme: "sky", font: "hind", dots: ["#0B4F7C", "#1FA4D6"] },
  { id: "prestige", name: "প্রিমিয়াম", desc: "গাঢ় রঙের হিরো, সোনালি ছোঁয়া — সিনিয়র কনসালট্যান্ট ও অধ্যাপকদের জন্য।", theme: "gold", font: "anek", dots: ["#1B2A3A", "#C9A24B"] },
  { id: "soft", name: "কোমল", desc: "নরম রং, গোল কোণা, বন্ধুসুলভ — শিশু, গাইনি ও দন্ত চিকিৎসকের জন্য।", theme: "rose", font: "anek", dots: ["#7C2D4A", "#E26D8C"] },
  { id: "bold", name: "স্পষ্ট", desc: "সোজা কোণা, রঙিন ব্লকের ওপর ছবি, বড় শিরোনাম — সার্জন ও ক্লিনিকের জন্য।", theme: "green", font: "anek", dots: ["#0F4D43", "#22A386"] },
  { id: "elegant", name: "রুচিশীল", desc: "ক্রিম রঙের পাতা, ক্লাসিক অক্ষরে শিরোনাম, খিলান ছবি — শান্ত ও অভিজাত।", theme: "plum", font: "hind", dots: ["#43306B", "#2BA39A"] },
] as const;

export type DesignId = (typeof DESIGNS)[number]["id"];
export const DESIGN_IDS = DESIGNS.map((d) => d.id) as [DesignId, ...DesignId[]];
export const isDesign = (v: unknown): v is DesignId => DESIGN_IDS.includes(v as DesignId);

/** ওয়েবসাইটের রং — থিম। নতুন রং যোগ করলে site.css-এ `.ws.th-<id>` (লাইট + ডার্ক) লিখতে হয়। */
export const THEME_IDS = ["navy", "green", "plum", "sky", "rose", "gold"] as const;
export type ThemeId = (typeof THEME_IDS)[number];
