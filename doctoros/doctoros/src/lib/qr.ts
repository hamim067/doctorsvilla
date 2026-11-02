import "server-only";
import { headers } from "next/headers";
import QRCode from "qrcode";

/** সাইটের ঠিকানা — APP_URL না থাকলে বর্তমান রিকোয়েস্ট থেকে */
export async function siteOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

/** QR কোড — SVG (পেজে বসানোর জন্য) */
export function qrSvg(text: string, color = "#0D2F2A") {
  return QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: color, light: "#ffffff" } });
}

/** QR কোড — PNG data URL (ডাউনলোডের জন্য) */
export function qrPng(text: string) {
  return QRCode.toDataURL(text, { margin: 2, width: 1024, errorCorrectionLevel: "M", color: { dark: "#0D2F2A", light: "#ffffff" } });
}
