import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "DoctorOS", template: "%s · DoctorOS" },
  description: "ডাক্তারের প্রোফাইল, সিরিয়াল, লাইভ ট্র্যাকিং ও ফলোআপ — এক জায়গায়",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
