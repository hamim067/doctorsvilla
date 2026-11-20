// ডিজাইন গ্যালারির ছোট ছবি বানায়: public/designs/<id>.jpg
// চালানোর নিয়ম: অ্যাপ চালু রাখুন (npm run dev / start), তারপর
//   node scripts/design-thumbs.mjs            (সব টেমপ্লেট)
//   node scripts/design-thumbs.mjs clean      (শুধু একটা)
// দরকার হলে: BASE=http://localhost:3000 SLUG=demo-tanvir
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// Playwright: প্রজেক্টে না থাকলে `npm i -D playwright && npx playwright install chromium`
const req = createRequire(import.meta.url);
const { chromium } = (() => { try { return req("playwright"); } catch { return req("playwright-core"); } })();

const BASE = process.env.BASE || "http://localhost:3000";
const SLUG = process.env.SLUG || "demo-tanvir";
const all = [...readFileSync(new URL("../src/lib/designs.ts", import.meta.url), "utf8").matchAll(/\{ id: "([a-z0-9-]+)"/g)].map((m) => m[1]);
const ids = process.argv.slice(2).length ? process.argv.slice(2) : all;

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 0.4 });
for (const id of ids) {
  await page.goto(`${BASE}/dr/${SLUG}?design=${id}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "*{animation:none!important;transition:none!important} .ws-preview{display:none!important}" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `public/designs/${id}.jpg`, type: "jpeg", quality: 82 });
  console.log("✓", id);
}
await browser.close();
