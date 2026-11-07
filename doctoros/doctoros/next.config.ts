import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  // লোগো আর নিজের প্যাডের ছবি (ব্রাউজারে ছোট করে পাঠানো হয়, তবু ১MB-এর বেশি হতে পারে)
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  // নিরাপত্তার সাধারণ হেডার — অন্য সাইট আমাদের পাতা ফ্রেমে ঢোকাতে পারবে না (নিজের প্রিভিউ চলবে)
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
