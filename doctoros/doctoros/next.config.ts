import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  // লোগো আর নিজের প্যাডের ছবি (ব্রাউজারে ছোট করে পাঠানো হয়, তবু ১MB-এর বেশি হতে পারে)
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default nextConfig;
